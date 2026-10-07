import { resolve } from '$app/paths';
import { superValidate } from 'sveltekit-superforms';
import type { PageLoad } from './$types';
import { zod4 } from 'sveltekit-superforms/adapters';
import TicketAssignment from '$lib/validation_schemas/TicketAssignments.zod';

export const load: PageLoad = async ({ fetch, params }) => {
	const ticket_fetch = await fetch(resolve('/api/tickets/' + params.ticket_id));
	const { data: ticket_data } = await ticket_fetch.json();

	const ticket_fetch_with_is_locked = await fetch(
		resolve(`/api/ticket-assignments/ticket/${ticket_data._id}/is-locked`)
	);
	const { data: assignments_data_is_locked } = await ticket_fetch_with_is_locked.json();

	const create_form = await superValidate(zod4(TicketAssignment.CreateSchema));
	const edit_form = await superValidate(zod4(TicketAssignment.EditSchema));

	return {
		ticket: ticket_data,
		assignments: assignments_data_is_locked,
		create_form: create_form,
		edit_form: edit_form
	};
};
