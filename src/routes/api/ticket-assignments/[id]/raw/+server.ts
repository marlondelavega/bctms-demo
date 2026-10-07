import { getTicketAssignmentById_Raw } from '$lib/server/services/TicketAssignments.service.js';
import { error, json } from '@sveltejs/kit';

export async function GET({ params, cookies }) {
	const _id = params.id;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}

	try {
		const assignment_data = await getTicketAssignmentById_Raw(_id);

		return json(
			{
				data: assignment_data
			},
			{ status: 200, statusText: 'Successfully retrieved ticket assignment' }
		);
	} catch (error) {
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
