import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import UserTypesModel from '$lib/server/models/UserTypes.model';
import { getPayments } from '$lib/server/services/Payment.service';
import { requireAccess, scopeFilter } from '$lib/server/utilities/permissions.server';

export async function GET(event: RequestEvent) {
	if (!event.cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}

	const user = event.locals.user;

	const allowed = requireAccess(user, 'payments');

	try {
		const url = event.url;
		const q = url.searchParams;

		const filter = await scopeFilter(user, allowed, { ownField: 'created_by' });

		const user_type = await UserTypesModel.findOne({
			user_type: { $regex: new RegExp(`^${q.get('user_type')}$`, 'i') }
		});

		if (user_type) {
			q.set('user_type', user_type._id.toString());
		}

		const payments = await getPayments(q, filter);

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: payments.data },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved payments',

				//custom headers
				headers: {
					//use custom X-Total-Count header to send total count _c
					'X-Total-Count': JSON.stringify(payments.total)
				}
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
