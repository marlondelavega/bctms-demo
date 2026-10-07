import { getTicketAssignments_byTicket } from '$lib/server/services/TicketAssignments.service';
import { error, json } from '@sveltejs/kit';

export async function GET({ params, cookies }) {
	const _id = params.ticket_id;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}

	try {
		//try to execute

		//find code provision by id
		const assignments = await getTicketAssignments_byTicket(_id);

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: assignments },

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
