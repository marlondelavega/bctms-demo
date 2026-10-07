import { connectDB } from '$lib/server/db/mongo';
import { getUser_byId } from '$lib/server/services/Users.service';
import { flagOverdueIssuances } from '$lib/server/services/Issuances.service';
import { verifySessionToken } from '$lib/server/utilities/session.server';
import {
	getActiveSession,
	revokeSession,
	touchSession
} from '$lib/server/services/Sessions.service';
import { session_revoke_reasons } from '$lib/server/models/Sessions.model';
import { redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { redirect as flashRedirect } from 'sveltekit-flash-message/server';
import { base } from '$app/paths';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';

await connectDB();

// Flags unpaid, past-grace-period issuances as overdue and escalates Issued -> Notice of
// Settlement. Runs once at boot and then hourly — adapter-node keeps this a long-lived process,
// so an in-process interval needs no separate cron infrastructure.
const OVERDUE_SCAN_INTERVAL_MS = 60 * 60 * 1000;

function runOverdueScan() {
	flagOverdueIssuances().catch((err) => console.error('Overdue issuance scan failed', err));
}

runOverdueScan();
setInterval(runOverdueScan, OVERDUE_SCAN_INTERVAL_MS);

export const handleError: HandleServerError = async ({ error, event, status }) => {
	const errorId = crypto.randomUUID();

	const stack = error instanceof Error ? error.stack : error;
	const cause =
		error instanceof Error && error.cause
			? error.cause instanceof Error
				? error.cause.stack
				: error.cause
			: undefined;

	console.error({
		errorId,
		status,
		method: event.request.method,
		url: event.url.pathname,
		routeId: event.route.id,
		error: stack,
		cause
	});

	const log_data: T_Log_C = {
		level: 'ERROR',
		type: 'REQUEST',
		message: error instanceof Error ? error.message : String(error),
		source: `${event.request.method} ${event.route.id ?? event.url.pathname}`,
		metadata: { errorId, status, stack, cause },
		user: logActor(event.locals.user)
	};

	await createLog(log_data);

	return { message: 'Something went wrong.', errorId };
};

export const handle: Handle = async ({ event, resolve }) => {
	const sessionCookie = event.cookies.get('bctms_auth_session');

	if (sessionCookie) {
		const token = verifySessionToken(sessionCookie);

		if (!token) {
			// Missing signature, or the cookie was tampered with client-side — reject outright.
			event.cookies.delete('bctms_auth_session', { path: '/' });
		} else if (token.exp - Date.now() <= 0) {
			event.cookies.delete('bctms_auth_session', { path: '/' });
			redirect(303, `${base}/login`);
		} else {
			// The sessions document is authoritative: revoked, idle-expired or unknown sessions are
			// rejected even though the cookie signature is valid.
			const session = await getActiveSession(token.sid);

			if (!session) {
				event.cookies.delete('bctms_auth_session', { path: '/' });
				flashRedirect(
					303,
					`${base}/login`,
					{ type: 'error', message: 'Your session has ended. Please log in again.' },
					event.cookies
				);
			}

			// Re-derive the user (and their permissions/role/archived status) from the DB on
			// every request, rather than trusting anything beyond the session's user id — so a
			// permission change or archive takes effect immediately.
			const fresh_user = await getUser_byId(session.user);

			if (!fresh_user || fresh_user.archived) {
				await revokeSession(session._id, session_revoke_reasons.USER_ARCHIVED);
				event.cookies.delete('bctms_auth_session', { path: '/' });
				flashRedirect(
					303,
					`${base}/login`,
					{ type: 'error', message: 'Your session is no longer valid. Please log in again.' },
					event.cookies
				);
			}

			// getUser_byId() returns a lean Mongoose doc — its _id fields (including nested
			// enforcement_group/user_type refs) are still ObjectId instances, not plain strings,
			// which breaks devalue serialization anywhere locals.user flows into page data (e.g.
			// login's `load` returning { user: locals.user }). Normalize to a plain JSON-safe object.
			event.locals.user = JSON.parse(JSON.stringify(fresh_user)) as App.Locals['user'];
			event.locals.session_id = session._id;

			// slides the idle timeout; throttled inside, and must never fail the request
			touchSession(session).catch((err) => console.error('Session touch failed', err));
		}
	}

	const path = event.url.pathname;
	const exempt_prefixes = [
		`${base}/api/users`,
		`${base}/api/auth`,
		`${base}/u/users/profile/change-password`
	];
	const is_exempt = exempt_prefixes.some((p) => path.startsWith(p));

	if (event.locals.user?.password_change && !is_exempt) {
		redirect(303, `${base}/u/users/profile/change-password`);
	}

	return resolve(event, {
		filterSerializedResponseHeaders: (name) => name.startsWith('x-')
	});
};
