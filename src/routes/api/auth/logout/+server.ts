import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { revokeSession } from '$lib/server/services/Sessions.service';
import { session_revoke_reasons } from '$lib/server/models/Sessions.model';

export async function POST({ cookies, locals }) {
	if (locals.session_id) {
		await revokeSession(locals.session_id, session_revoke_reasons.LOGOUT, locals.user?._id);
	}

	cookies.delete('bctms_auth_session', { path: '/' });
	redirect(303, `${base}/login`);
}
