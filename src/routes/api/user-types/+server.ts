import { getUserTypes } from '$lib/server/services/UserTypes.service';
import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { requireAccess, scopeFilter } from '$lib/server/utilities/permissions.server';

export async function GET(event: RequestEvent) {
	if (!event.cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	try {
		const user = event.locals.user;
		const allowed = requireAccess(user, 'user_types');
		const _url = event.url;
		const _q = _url.searchParams;

		_q.set('access_level', user.user_type.access_level);
		const filter = await scopeFilter(user, allowed, { ownField: 'created_by' });

		//find all user types
		const user_types = await getUserTypes(_q, filter);

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: user_types.data },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved user types',

				//custom headers
				headers: {
					//use custom X-Total-Count header to send total count _c
					'X-Total-Count': JSON.stringify(user_types.total)
				}
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
