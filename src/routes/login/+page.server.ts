import { error, type RequestEvent } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import type { Actions, PageServerLoad } from './$types';
import { zod4 } from 'sveltekit-superforms/adapters';
import { validateAccount, validateUsername } from '$lib/server/services/Auth.service';
import { redirect } from 'sveltekit-flash-message/server';
import { log_levels, log_types, type T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import Login from '$lib/validation_schemas/Login.zod';
import { getUser_byId } from '$lib/server/services/Users.service';
import { resolve } from '$app/paths';
import { createSessionToken } from '$lib/server/utilities/session.server';
import { createSession, SESSION_ABSOLUTE_TIMEOUT_MS } from '$lib/server/services/Sessions.service';
import {
	clearKey,
	minutesLabel,
	recordHit,
	retryAfter
} from '$lib/server/utilities/rate_limit.server';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, demoUsernames } from '$lib/server/demo/accounts';
import { isDemoMode } from '$lib/server/demo/guards';

// wrong-password guesses: per address and per username, over a sliding-ish 15 minutes
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_IP = 20;
const MAX_FAILS_PER_USERNAME = 8;
// one-click demo logins have no password to guess, so this only stops a script from hammering them
const DEMO_WINDOW_MS = 10 * 60 * 1000;
const MAX_DEMO_LOGINS_PER_IP = 30;

export const load: PageServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		demo_accounts: isDemoMode()
			? DEMO_ACCOUNTS.map(({ key, label, blurb }) => ({ key, label, blurb }))
			: []
	};
};

function clientAddress(event: RequestEvent) {
	try {
		// behind a reverse proxy this is only the real client address if ADDRESS_HEADER/XFF_DEPTH
		// are configured for adapter-node; otherwise every visitor shares the proxy's address
		return event.getClientAddress();
	} catch {
		return '';
	}
}

/**
 * Opens a session for an already-verified user, sets the cookie, writes the login log and
 * redirects. Never returns.
 */
async function signIn(
	event: RequestEvent,
	user_id: string,
	must_change_password: boolean,
	ip: string
) {
	const { request, cookies } = event;
	const user_data = await getUser_byId(user_id);

	// the featured demo accounts are shared by many visitors, so the usual 3-session cap would sign them out
	const shared_demo_account = isDemoMode() && !!user_data && demoUsernames.has(user_data.username);

	const session_id = await createSession({
		user_id,
		ip,
		user_agent: request.headers.get('user-agent') ?? '',
		max_sessions: shared_demo_account ? 500 : undefined
	});

	const token = createSessionToken({
		sid: session_id,
		exp: Date.now() + SESSION_ABSOLUTE_TIMEOUT_MS
	});

	cookies.set('bctms_auth_session', token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'strict',
		maxAge: 60 * 60 * 36 //1 & 1/2 days max age (browser automatically deletes the cookie)
	});

	if (user_data) {
		const log_data: T_Log_C = {
			level: log_levels.INFO,
			type: log_types.LOGIN,
			message: 'login user',
			source: 'login page',
			user: logActor(user_data)
		};

		await createLog(log_data);
	}

	if (must_change_password) {
		redirect(
			resolve('/u/users/profile/change-password'),
			{
				type: 'success',
				message: 'Logged in successfully but you need to change temporary password.'
			},
			cookies
		);
	}

	redirect(resolve('/u'), { type: 'success', message: 'Logged in successfully.' }, cookies);
}

export const actions: Actions = {
	login: async (event) => {
		const { request } = event;
		//validate using superValidate
		const form = await superValidate(request, zod4(Login.Schema));

		//return message with status 400 if NOT valid
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const ip = clientAddress(event);
		const ip_key = `login-fail:ip:${ip}`;
		const user_key = `login-fail:user:${form.data.username.trim().toLowerCase()}`;

		const wait = Math.max(
			retryAfter(ip_key, MAX_FAILS_PER_IP),
			retryAfter(user_key, MAX_FAILS_PER_USERNAME)
		);
		if (wait > 0) {
			return message(
				form,
				{
					type: 'error',
					text: `Too many failed attempts. Try again in ${minutesLabel(wait)}.`
				},
				{ status: 429 }
			);
		}

		const fail = () => {
			recordHit(ip_key, FAIL_WINDOW_MS);
			recordHit(user_key, FAIL_WINDOW_MS);
			// Deliberately identical for an unknown username and a wrong password, so the message
			// doesn't reveal whether the username exists (user enumeration).
			return message(
				form,
				{ type: 'error', text: 'Incorrect username or password.' },
				{ status: 400 }
			);
		};

		const _v = await validateUsername(form.data);
		if (!_v) return fail();

		const _p = await validateAccount(form.data);
		if (!_p) return fail();

		clearKey(user_key);
		return signIn(event, String(_v._id), !!_v.password_change, ip);
	},

	// demo only: sign in as one of the featured accounts without typing anything
	demo: async (event) => {
		if (!isDemoMode()) error(404, 'Not found');

		// a failed one-click login goes back to the page with a toast, rather than an error page
		const back = (text: string) =>
			redirect(resolve('/login'), { type: 'error', message: text }, event.cookies);

		const data = await event.request.formData();
		const account = DEMO_ACCOUNTS.find((a) => a.key === data.get('account'));
		if (!account) return back('Unknown demo account.');

		const ip = clientAddress(event);
		const key = `demo-login:ip:${ip}`;
		const wait = retryAfter(key, MAX_DEMO_LOGINS_PER_IP);
		if (wait > 0) return back(`Too many sign-ins. Try again in ${minutesLabel(wait)}.`);
		recordHit(key, DEMO_WINDOW_MS);

		const credentials = { username: account.username, password: DEMO_PASSWORD };
		const user = await validateUsername(credentials);
		if (!user || !(await validateAccount(credentials))) {
			return back('The demo data is being reset. Try again in a minute.');
		}

		return signIn(event, String(user._id), false, ip);
	}
};
