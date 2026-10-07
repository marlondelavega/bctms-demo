import { getIssuance_byAssignmentIds } from '$lib/server/services/Issuances.service.js';
import { error, json } from '@sveltejs/kit';

export async function GET({ params, cookies }) {
	const _ids = params.ids;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	try {
		//try to execute
		const ids = _ids.split('/').filter((e) => e !== '');

		//find user type by id
		const issuance = await getIssuance_byAssignmentIds(ids);

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: issuance },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved issuances'
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
