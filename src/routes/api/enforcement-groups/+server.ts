import { getEnforcementGroups } from '$lib/server/services/EnforcementGroup.service';
import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { requireAccess } from '$lib/server/utilities/permissions.server';

export async function GET(event: RequestEvent) {
	if (!event.cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	try {
		const user = event.locals.user;
		const allowed = requireAccess(user, 'enforcement_groups');
		const _url = event.url;
		const _q = _url.searchParams;

		if (allowed == 'office') {
			// this collection *is* the enforcement group — office scope means "only your own group"
			_q.set('enforcement_group', user.enforcement_group._id.toString());
		} else if (allowed == 'own') {
			_q.set('created_by', user._id);
		}

		//find all groups
		const groups = await getEnforcementGroups(_q);

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: groups.data },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved enforcement groups',

				//custom headers
				headers: {
					//use custom X-Total-Count header to send total count _c
					'X-Total-Count': JSON.stringify(groups.total)
				}
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
