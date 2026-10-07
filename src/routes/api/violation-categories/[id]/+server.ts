import { getViolationCategory_byId } from '$lib/server/services/ViolationCategories.service';
import { error, json } from '@sveltejs/kit';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';

export async function GET({ params, cookies, locals }) {
	const _id = params.id;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const allowed = requireAccess(locals.user, 'violation_categories');
	try {
		//try to execute

		//find violation category by id
		const category = await getViolationCategory_byId(_id);
		await assertOwnership(locals.user, allowed, category, { ownField: 'created_by' });

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: category },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved violation category'
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
