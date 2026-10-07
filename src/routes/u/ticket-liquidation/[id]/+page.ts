import { permissions } from '$lib/utilities/helper';
import type Issuance from '$lib/validation_schemas/Issuances.zod';
import type TicketAssignment from '$lib/validation_schemas/TicketAssignments.zod';
import type Ticket from '$lib/validation_schemas/Tickets.zod';
import type User from '$lib/validation_schemas/Users.zod';
import type Violator from '$lib/validation_schemas/Violators.zod';
import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent, fetch }) => {
	const _id = params.id;
	const { user } = await parent();

	if (permissions.get('issuance', user.user_type.permissions as string[]).access == 'none') {
		return {
			ticket: {},
			ticket_assignments: {},
			issuances: [],
			series_row: [],
			authorized: false
		};
	}

	const ticket_promise = await fetch(resolve(`/api/tickets/${_id}`));
	const assignment_promise = await fetch(resolve(`/api/ticket-assignments/ticket/${_id}`));

	if (!ticket_promise.ok || !assignment_promise.ok) {
		return {
			ticket: {},
			ticket_assignments: [],
			issuances: [],
			series_row: [],
			authorized: true
		};
	}

	const _ticket = await ticket_promise.json();
	const _assignment = await assignment_promise.json();

	// API responded 200 but the ticket itself doesn't exist (or assignment data is malformed)
	if (!_ticket.data || !_assignment.data) {
		return {
			ticket: {},
			ticket_assignments: [],
			issuances: [],
			series_row: [],
			authorized: true
		};
	}

	let _issuances: { data: Issuance.Base<TicketAssignment.Base, User.Base, Violator.Base>[] } = {
		data: []
	};

	if (_assignment.data.length > 0) {
		const assignment_ids = _assignment.data.reduce(
			(acc: string, cur: TicketAssignment.Base<User.Base, Ticket.Base, User.Base>) =>
				acc + `/${cur._id}`,
			''
		);

		const issuances_promise = await fetch(resolve(`/api/issuances/${assignment_ids}`));

		if (issuances_promise.ok) {
			_issuances = await issuances_promise.json();
		}
	}

	const rows: Ticket.SeriesRow[] = [];

	for (let s = _ticket.data.ticket_num_from; s <= _ticket.data.ticket_num_to; s++) {
		const assignment = _assignment.data.find(
			(a: TicketAssignment.Base<User.Base, Ticket.Base, User.Base>) =>
				s >= a.series_from && s <= a.series_to
		);

		const issuance = _issuances.data.find(
			(i: Issuance.Base<TicketAssignment.Base, User.Base, Violator.Base>) =>
				i.ticket_series === s && i.ticket_assignment._id === assignment?._id
		);

		rows.push({ series: s, assignment, issuance });
	}

	return {
		ticket: _ticket.data,
		ticket_assignments: _assignment.data,
		issuances: _issuances.data,
		series_row: rows,
		authorized: true
	};
};
