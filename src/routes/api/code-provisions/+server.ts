import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getCodeProvisions } from '$lib/server/services/CodeProvisions.service';
import { requireAccess } from '$lib/server/utilities/permissions.server';

export async function GET(event: RequestEvent) {
	if (!event.cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const user = event.locals.user;

	const allowed = requireAccess(user, 'code_provisions');

	try {
		const _url = event.url;
		const _q = _url.searchParams;

		if (allowed == 'office') {
			_q.set('enforcement_group', user.enforcement_group._id);
		} else if (allowed == 'own') {
			_q.set('created_by', user._id);
		}

		//find all groups
		const provisions = await getCodeProvisions(_q);

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: provisions.data },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved code provisions',

				//custom headers
				headers: {
					//use custom X-Total-Count header to send total count _c
					'X-Total-Count': JSON.stringify(provisions.total)
				}
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
