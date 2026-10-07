import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getTicketAssignments } from '$lib/server/services/TicketAssignments.service';
import { requireAccess, scopeFilter } from '$lib/server/utilities/permissions.server';

export async function GET(event: RequestEvent) {
	if (!event.cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const user = event.locals.user;

	const allowed = requireAccess(user, 'ticket_assignments');

	try {
		//try to execute

		const _url = event.url;
		const _q = _url.searchParams;
		const filter = await scopeFilter(user, allowed, { ownField: 'assigned_by' });

		const tickets = await getTicketAssignments(_q, filter);

		return json(
			//response body
			{ data: tickets.data },

			//response status
			{
				status: 200,
				statusText: tickets.data.length
					? 'Successfully retrieved tickets assignments'
					: 'No ticket assignments found',

				//custom headers
				headers: {
					//use custom X-Total-Count header to send total count _c
					'X-Total-Count': JSON.stringify(tickets.total)
				}
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
