import { getIssuanceById, getIssuanceById_Raw } from '$lib/server/services/Issuances.service.js';
import { error, json } from '@sveltejs/kit';

export async function GET({ params, cookies }) {
	const _id = params.id;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	try {
		//try to execute

		//find user type by id
		const issuance = await getIssuanceById_Raw(_id);

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
