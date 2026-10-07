import { getTickets } from '$lib/server/services/Tickets.service';
import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { requireAccess, scopeFilter } from '$lib/server/utilities/permissions.server';

export async function GET(event: RequestEvent) {
	if (!event.cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const user = event.locals.user;

	const allowed = requireAccess(user, 'tickets');

	try {
		//try to execute
		const _url = event.url;
		const _q = _url.searchParams;
		const filter = await scopeFilter(user, allowed, {
			ownField: 'created_by',
			officeField: 'ticket_for'
		});

		//find all tickets
		const tickets = await getTickets(_q, filter);

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: tickets.data },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved tickets',

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
