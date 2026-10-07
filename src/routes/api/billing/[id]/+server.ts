import { getBilling_byId } from '$lib/server/services/Billing.service.js';
import { error, json } from '@sveltejs/kit';
import { requireAccess, assertBillingOwnership } from '$lib/server/utilities/permissions.server';

export async function GET({ params, cookies, locals }) {
	const _id = params.id;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const allowed = requireAccess(locals.user, 'billing');
	try {
		const data = await getBilling_byId(_id);
		await assertBillingOwnership(locals.user, allowed, data);

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
