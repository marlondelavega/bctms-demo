import { error, json } from '@sveltejs/kit';
import { getTicket_byId } from '$lib/server/services/Tickets.service';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';

export async function GET({ params, cookies, locals }) {
	const _id = params.id;

	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const allowed = requireAccess(locals.user, 'tickets');

	try {
		//find ticket by id
		const _t = await getTicket_byId(_id);
		await assertOwnership(locals.user, allowed, _t, {
			ownField: 'created_by',
			officeField: 'ticket_for'
		});

		return json(
			{ data: _t },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved ticket'
			}
		);
	} catch (error) {
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
