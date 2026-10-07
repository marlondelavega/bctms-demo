import { getTicketAssignmentById } from '$lib/server/services/TicketAssignments.service.js';
import { error, json } from '@sveltejs/kit';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';

export async function GET({ params, cookies, locals }) {
	const _id = params.id;
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const allowed = requireAccess(locals.user, 'ticket_assignments');

	try {
		const assignment_data = await getTicketAssignmentById(_id);
		await assertOwnership(locals.user, allowed, assignment_data, { ownField: 'assigned_by' });

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
