import { getBilling_byIssuance } from '$lib/server/services/Billing.service.js';
import { error, json } from '@sveltejs/kit';

export async function GET({ params, cookies }) {
	const _id = params.issuance_id;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	try {
		const data = await getBilling_byIssuance(_id);

		return json(
			{ data: data },
			{
				status: 200,
				statusText: 'Successfully retrieved billing data'
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
