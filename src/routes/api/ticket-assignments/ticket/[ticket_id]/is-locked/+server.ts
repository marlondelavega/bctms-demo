import { getTicketAssignmentsWithLockStatus } from '$lib/server/services/TicketAssignments.service';
import { error, json } from '@sveltejs/kit';

export async function GET({ params, cookies }) {
	const _id = params.ticket_id;

	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}

	try {
		const assignment_data = await getTicketAssignmentsWithLockStatus(_id);

		return json(
			{
				data: assignment_data
			},
			{
				status: 200,
				statusText: 'Successfully retrieved ticket assignments with is_locked status.'
			}
		);
	} catch (error) {
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
