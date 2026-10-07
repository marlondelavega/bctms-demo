import { error, json } from '@sveltejs/kit';
import { getPaymentsByIssuance } from '$lib/server/services/Payment.service';
import IssuanceModel from '$lib/server/models/Issuance.model';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';
import type { RequestEvent } from './$types';

export async function GET(event: RequestEvent) {
	if (!event.cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}

	const user = event.locals.user;

	const allowed = requireAccess(user, 'payments');

	try {
		const issuance_id = event.params.issuance_id;

		if (allowed !== 'all') {
			const issuance = await IssuanceModel.findById(issuance_id).lean();
			await assertOwnership(user, allowed, issuance, { ownField: 'issuer' });
		}

		const payments = await getPaymentsByIssuance(issuance_id);

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: payments },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved payment by issuance.'
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
