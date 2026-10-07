import { error, json } from '@sveltejs/kit';
import { getViolator_byId } from '$lib/server/services/Violators.service';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';

export async function GET({ params, cookies, locals }) {
	const _id = params.id;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const allowed = requireAccess(locals.user, 'violators');
	try {
		//try to execute

		//find violator by id
		const violator = await getViolator_byId(_id);
		await assertOwnership(locals.user, allowed, violator, { ownField: 'created_by' });

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: violator },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved violator'
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
