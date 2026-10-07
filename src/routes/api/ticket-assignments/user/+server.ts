import { getTicketAssignments } from '$lib/server/services/TicketAssignments.service';
import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export async function GET(event: RequestEvent) {
	if (!event.cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}

	try {
		//try to execute

		const _url = event.url;
		const _q = _url.searchParams;
		if (!_q.has('user') || _q.get('user') == '') {
			_q.set('user', event.locals.user._id.toString());
		}

		//find code provision by id
		const assignments = await getTicketAssignments(_q);

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: assignments.data },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved ticket assignments'
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
