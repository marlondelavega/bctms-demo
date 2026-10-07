import { getUsers } from '$lib/server/services/Users.service';
import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import UserTypesModel from '$lib/server/models/UserTypes.model';
import { requireAccess } from '$lib/server/utilities/permissions.server';

export async function GET(event: RequestEvent) {
	if (!event.cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const user = event.locals.user;

	const allowed = requireAccess(user, 'users');

	try {
		const _url = event.url;
		const _q = _url.searchParams;

		if (allowed == 'office') {
			_q.set('enforcement_group', user.enforcement_group._id);
		} else if (allowed == 'own') {
			_q.set('created_by', user._id);
		}

		function escapeRegex(str: string) {
			return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		}

		const rawInput = _q.get('user_type') ?? '';
		if (rawInput && rawInput !== '') {
			const user_type = await UserTypesModel.findOne({
				user_type: { $regex: new RegExp(escapeRegex(rawInput), 'i') }
			});

			if (user_type) {
				_q.set('user_type', user_type._id.toString());
			}
		}

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
