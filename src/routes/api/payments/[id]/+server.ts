import { getPayment_byId } from '$lib/server/services/Payment.service';
import { error, json } from '@sveltejs/kit';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, cookies, locals }) => {
	const _id = params.id;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const allowed = requireAccess(locals.user, 'payments');
	try {
		const data = await getPayment_byId(_id);
		await assertOwnership(locals.user, allowed, data, { ownField: 'created_by' });

		return json(
			{ data: data },
			{
				status: 200,
				statusText: 'Successfully retrieved payment data'
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
};
