import { getUser_byId } from '$lib/server/services/Users.service.js';
import { error, json } from '@sveltejs/kit';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';

export async function GET({ params, cookies, locals }) {
	const _id = params.id;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const allowed = requireAccess(locals.user, 'users');
	try {
		//try to execute

		//find user type by id
		const user_types = await getUser_byId(_id);
		await assertOwnership(locals.user, allowed, user_types, {
			ownField: 'created_by',
			officeField: 'enforcement_group'
		});

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: user_types },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved user type'
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
