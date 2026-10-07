import { getIssuance_byTrackingCode } from '$lib/server/services/Issuances.service';
import { error, json } from '@sveltejs/kit';

export async function GET({ params, cookies }) {
	const code = params.tracking_code;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}

	try {
		const issuances = await getIssuance_byTrackingCode(code);
		return json(issuances, { status: 200 });
	} catch (error) {
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
