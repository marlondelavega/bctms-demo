import { getLastSeriesNumber } from '$lib/server/services/TicketAssignments.service';
import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export async function GET(event: RequestEvent) {
	if (!event.cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}

	try {
		//try to execute
		const ticket_id = event.params.id;

		//find code provision by id
		const series = await getLastSeriesNumber(ticket_id);

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ ...series },

			//response status
			{
				status: 200,
				statusText: series
					? 'Successfully retrieved ticket assignments'
					: 'No ticket assignments found for the specified ticket'
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
