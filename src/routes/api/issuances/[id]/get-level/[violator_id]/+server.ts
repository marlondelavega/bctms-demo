import { getViolationLevel } from '$lib/server/services/Issuances.service';
import { error, json } from '@sveltejs/kit';

export async function GET({ params, cookies }) {
	try {
		if (!cookies.get('bctms_auth_session')) {
			error(403, 'Forbidden');
		}
		const level = await getViolationLevel(params.violator_id, params.id);

		return json(
			{ data: level },
			{
				status: 200,
				statusText: 'Successfully retrieved violation level'
			}
		);
	} catch (error) {
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
