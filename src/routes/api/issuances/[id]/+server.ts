import { getIssuanceById } from '$lib/server/services/Issuances.service.js';
import { error, json } from '@sveltejs/kit';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';

export async function GET({ params, cookies, locals }) {
	const _id = params.id;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const allowed = requireAccess(locals.user, 'issuance');
	try {
		//try to execute

		//find user type by id
		const issuance = await getIssuanceById(_id);
		await assertOwnership(locals.user, allowed, issuance, { ownField: 'issuer' });

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: issuance },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved issuance'
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
