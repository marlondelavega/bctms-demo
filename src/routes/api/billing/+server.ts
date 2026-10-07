import type { RequestEvent } from './$types';
import { error, json } from '@sveltejs/kit';
import { getBillings } from '$lib/server/services/Billing.service';
import { requireAccess, billingScopeFilter } from '$lib/server/utilities/permissions.server';

export async function GET(event: RequestEvent) {
	if (!event.cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const user = event.locals.user;

	const allowed = requireAccess(user, 'billing');

	try {
		const url = event.url;
		const params = url.searchParams;
		const filter = await billingScopeFilter(user, allowed);

		const billings = await getBillings(params, filter);

		return json(
			{ data: billings.data },
			{
				status: 200,
				statusText: billings.data.length ? 'Successfully retrieved billings' : 'No billings found',
				headers: {
					'X-Total-Count': JSON.stringify(billings.total)
				}
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
