import { getUsers } from '$lib/server/services/Users.service';
import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { requireAccess } from '$lib/server/utilities/permissions.server';

export async function GET(event: RequestEvent) {
	if (!event.cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const user = event.locals.user;

	requireAccess(user, 'users');

	try {
		const _url = event.url;
		const _q = _url.searchParams;

		_q.set('access_levels', [1, 2].join(','));

		//find all users
		const users = await getUsers(_q);

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: users.data },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved users',

				//custom headers
				headers: {
					//use custom X-Total-Count header to send total count _c
					'X-Total-Count': JSON.stringify(users.total)
				}
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
