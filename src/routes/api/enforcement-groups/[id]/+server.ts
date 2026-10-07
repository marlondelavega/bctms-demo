import { getEnforcementGroup_byId } from '$lib/server/services/EnforcementGroup.service.js';
import { error, json } from '@sveltejs/kit';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';

export async function GET({ params, cookies, locals }) {
	const _id = params.id;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const allowed = requireAccess(locals.user, 'enforcement_groups');
	try {
		//try to execute

		//find user type by id
		const _eg = await getEnforcementGroup_byId(_id);
		await assertOwnership(locals.user, allowed, _eg, {
			ownField: 'created_by',
			officeFilter: (u) => ({ _id: u.enforcement_group })
		});

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: _eg },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved enforcement group'
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
