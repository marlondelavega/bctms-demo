import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { base } from '$app/paths';
import UsersModel from '$lib/server/models/Users.model';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { session_revoke_reasons } from '$lib/server/models/Sessions.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import {
	getUserActiveSessions,
	revokeOtherUserSessions,
	revokeSession
} from '$lib/server/services/Sessions.service';

type AccountMeta = {
	created_at?: Date;
	last_password_change_date?: Date;
	created_by?: { firstname: string; lastname: string } | null;
};

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, `${base}/login`);

	const [account, sessions] = await Promise.all([
		UsersModel.findById(locals.user._id)
			.select('created_at last_password_change_date created_by')
			.populate('created_by', 'firstname lastname')
			.lean<AccountMeta>(),
		getUserActiveSessions(locals.user._id)
	]);

	return {
		account: {
			created_at: account?.created_at ?? null,
			last_password_change_date: account?.last_password_change_date ?? null,
			created_by: account?.created_by
				? `${account.created_by.firstname} ${account.created_by.lastname}`
				: null
		},
		sessions,
		current_session_id: locals.session_id ?? null
	};
};

const logSignOut = async (locals: App.Locals, message: string, session_ids: string[]) => {
	const log_data: T_Log_C = {
		level: 'INFO',
		type: 'EDIT',
		message,
		source: 'profile form action - sessions',
		affected_collection: { collection_name: 'sessions', document_id: session_ids },
		user: logActor(locals.user)
	};
	await createLog(log_data);
};

export const actions: Actions = {
	sign_out_session: async ({ request, locals }) => {
		if (!locals.user) redirect(303, `${base}/login`);

		const session_id = String((await request.formData()).get('session_id') ?? '');
		if (session_id === locals.session_id) {
			return fail(400, { error: 'Use Sign out to end the session on this device.' });
		}

		// only sessions that belong to the signed-in user can be ended from here
		const sessions = await getUserActiveSessions(locals.user._id);
		if (!sessions.some((s) => s._id === session_id)) {
			return fail(404, { error: 'That session has already ended.' });
		}

		await revokeSession(session_id, session_revoke_reasons.LOGOUT, locals.user._id);
		await logSignOut(locals, 'signed out a session from the profile page', [session_id]);

		return { success: 'Signed out of that device.' };
	},

	sign_out_others: async ({ locals }) => {
		if (!locals.user || !locals.session_id) redirect(303, `${base}/login`);

		const sessions = await getUserActiveSessions(locals.user._id);
		const others = sessions.filter((s) => s._id !== locals.session_id).map((s) => s._id);
		if (!others.length) return { success: 'No other devices are signed in.' };

		const ended = await revokeOtherUserSessions(
			locals.user._id,
			locals.session_id,
			session_revoke_reasons.LOGOUT,
			locals.user._id
		);
		await logSignOut(locals, 'signed out all other sessions from the profile page', others);

		return {
			success: `Signed out of ${ended} other ${ended === 1 ? 'device' : 'devices'}.`
		};
	}
};
