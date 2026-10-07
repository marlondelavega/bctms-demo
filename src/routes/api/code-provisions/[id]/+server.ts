import { getCodeProvision_byId } from '$lib/server/services/CodeProvisions.service.js';
import { error, json } from '@sveltejs/kit';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';

export async function GET({ params, cookies, locals }) {
	const _id = params.id;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const allowed = requireAccess(locals.user, 'code_provisions');

	try {
		//try to execute

		//find code provision by id
		const provision = await getCodeProvision_byId(_id);
		await assertOwnership(locals.user, allowed, provision, {
			ownField: 'created_by',
			officeField: 'enforcement_group'
		});

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: provision },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved code provision'
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
