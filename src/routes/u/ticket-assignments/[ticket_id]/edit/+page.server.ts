import { message, superValidate } from 'sveltekit-superforms';
import type { Actions } from './$types';
import TicketAssignment from '$lib/validation_schemas/TicketAssignments.zod';
import { zod4 } from 'sveltekit-superforms/adapters';
import IssuanceModel from '$lib/server/models/Issuance.model';
import {
	createTicketAssignment,
	getTicketAssignmentById,
	getTicketAssignments_byTicket,
	updateTicketAssignment
} from '$lib/server/services/TicketAssignments.service';
import { getTicket_byId } from '$lib/server/services/Tickets.service';
import { toObjectId } from '$lib/utilities/helper';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import type User from '$lib/validation_schemas/Users.zod';
import type Ticket from '$lib/validation_schemas/Tickets.zod';
import TicketAssignmentsModel from '$lib/server/models/TicketAssignments.model';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';

export const actions: Actions = {
	edit: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(TicketAssignment.EditSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const edit_scope = requireAccess(locals.user, 'ticket_assignments', 'edit');
		const existing_assignment = await TicketAssignmentsModel.findById(form.data._id).lean();
		await assertOwnership(locals.user, edit_scope, existing_assignment, {
			ownField: 'assigned_by'
		});

		const assignmentId = toObjectId(form.data._id);
		if (!assignmentId) {
			return message(
				form,
				{ type: 'error', text: 'The assignment ID is invalid.' },
				{ status: 400 }
			);
		}

		const assignment = (await getTicketAssignmentById(form.data._id)) as TicketAssignment.Base<
			User.Base,
			Ticket.Base,
			User.Base
		> | null;
		const ticket = await getTicket_byId(form.data.ticket);

		if (!assignment || !ticket || ticket.archived) {
			return message(
				form,
				{ type: 'error', text: 'The ticket assignment or ticket no longer exists.' },
				{ status: 400 }
			);
		}

		// Guard against a mismatched _id/ticket pair being submitted together —
		// the assignment must actually belong to the ticket in the payload.
		if (assignment.ticket._id.toString() !== form.data.ticket) {
			return message(
				form,
				{ type: 'error', text: 'This assignment does not belong to the specified ticket.' },
				{ status: 400 }
			);
		}

		const locked = await IssuanceModel.exists({ ticket_assignment: assignmentId });
		if (locked) {
			return message(
				form,
				{ type: 'error', text: 'This assignment cannot be edited because it has issued tickets.' },
				{ status: 400 }
			);
		}

		const seriesErrors: { series_from?: string[]; series_to?: string[] } = {};

		if (
			form.data.series_from < ticket.ticket_num_from ||
			form.data.series_from > ticket.ticket_num_to
		) {
			seriesErrors.series_from = [
				`Series "from" must be between #${ticket.ticket_num_from} and #${ticket.ticket_num_to}.`
			];
		}

		if (
			form.data.series_to < ticket.ticket_num_from ||
			form.data.series_to > ticket.ticket_num_to
		) {
			seriesErrors.series_to = [
				`Series "to" must be between #${ticket.ticket_num_from} and #${ticket.ticket_num_to}.`
			];
		}

		// Only meaningful once both bounds individually check out — comparing an
		// already-out-of-range from/to against each other would just produce a
		// confusing second error on top of the bounds error. "from" equal to "to" is
		// valid: it's an assignment of a single ticket.
		if (!seriesErrors.series_from && !seriesErrors.series_to) {
			if (form.data.series_from > form.data.series_to) {
				seriesErrors.series_to = [`Series "to" can't be lower than series "from".`];
			}
		}

		if (seriesErrors.series_from || seriesErrors.series_to) {
			if (seriesErrors.series_from) form.errors.series_from = seriesErrors.series_from;
			if (seriesErrors.series_to) form.errors.series_to = seriesErrors.series_to;

			return message(
				form,
				{ type: 'error', text: 'The ticket series you entered is invalid.' },
				{ status: 400 }
			);
		}

		// Bounds against the ticket's own series — replaces the old
		// "min = max(series_to)" approach, which only ever allowed appending
		// after the highest assigned series and couldn't validate a submission
		// into an earlier gap (e.g. after a previous assignment was shrunk).
		if (
			form.data.series_from < ticket.ticket_num_from ||
			form.data.series_to > ticket.ticket_num_to ||
			form.data.series_from > form.data.series_to
		) {
			form.errors.series_to = [
				`Series must stay within the ticket's own range (#${ticket.ticket_num_from} - #${ticket.ticket_num_to}).`
			];
			return message(
				form,
				{ type: 'error', text: 'The ticket series you entered is invalid.' },
				{ status: 400 }
			);
		}

		const assignments = await getTicketAssignments_byTicket(form.data.ticket);
		const overlapping = assignments.find(
			(other) =>
				other._id.toString() !== form.data._id &&
				other.series_from <= form.data.series_to &&
				other.series_to >= form.data.series_from
		);

		if (overlapping) {
			form.errors.series_to = [
				`This range overlaps assignment #${overlapping.series_from} - #${overlapping.series_to}.`
			];
			return message(
				form,
				{ type: 'error', text: 'The assignment series overlaps another assignment.' },
				{ status: 400 }
			);
		}

		const oldAssignment = await getTicketAssignmentById(form.data._id);
		const updatedAssignment = await updateTicketAssignment(form.data);

		if (!updatedAssignment) {
			return message(
				form,
				{ type: 'error', text: 'Currently cannot process your request. Please try again later.' },
				{ status: 400 }
			);
		}

		const logData: T_Log_C = {
			level: 'INFO',
			type: 'EDIT',
			message: 'edited ticket assignment',
			source: 'ticket assignment form action - edit',
			affected_collection: {
				collection_name: 'ticket_assignments',
				document_id: [updatedAssignment._id.toString()]
			},
			user: logActor(locals.user),
			metadata: {
				from: oldAssignment,
				to: updatedAssignment
			}
		};

		await createLog(logData);
		return message(form, { type: 'success', text: 'Assignment updated successfully.' });
	},

	create: async ({ request, locals }) => {
		requireAccess(locals.user, 'ticket_assignments', 'create');

		const form = await superValidate(request, zod4(TicketAssignment.CreateSchema), { id: 'form' });

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const ticket = await getTicket_byId(form.data.ticket);

		if (!ticket)
			return message(form, { type: 'error', text: 'Ticket does not exist.' }, { status: 400 });

		const ticket_assignments = await getTicketAssignments_byTicket(form.data.ticket);

		const seriesErrors: { series_from?: string[]; series_to?: string[] } = {};

		if (
			form.data.series_from < ticket.ticket_num_from ||
			form.data.series_from > ticket.ticket_num_to
		) {
			seriesErrors.series_from = [
				`Series "from" must be between #${ticket.ticket_num_from} and #${ticket.ticket_num_to}.`
			];
		}

		if (
			form.data.series_to < ticket.ticket_num_from ||
			form.data.series_to > ticket.ticket_num_to
		) {
			seriesErrors.series_to = [
				`Series "to" must be between #${ticket.ticket_num_from} and #${ticket.ticket_num_to}.`
			];
		}

		// Only meaningful once both bounds individually check out — comparing an
		// already-out-of-range from/to against each other would just produce a
		// confusing second error on top of the bounds error. "from" equal to "to" is
		// valid: it's an assignment of a single ticket.
		if (!seriesErrors.series_from && !seriesErrors.series_to) {
			if (form.data.series_from > form.data.series_to) {
				seriesErrors.series_to = [`Series "to" can't be lower than series "from".`];
			}
		}

		if (seriesErrors.series_from || seriesErrors.series_to) {
			if (seriesErrors.series_from) form.errors.series_from = seriesErrors.series_from;
			if (seriesErrors.series_to) form.errors.series_to = seriesErrors.series_to;

			return message(
				form,
				{ type: 'error', text: 'The ticket series you entered is invalid.' },
				{ status: 400 }
			);
		}

		// Bounds against the ticket's own series — replaces the old
		// "min = max(series_to)" approach, which only ever allowed appending
		// after the highest assigned series and couldn't validate a submission
		// into an earlier gap (e.g. after a previous assignment was shrunk).
		if (
			form.data.series_from < ticket.ticket_num_from ||
			form.data.series_to > ticket.ticket_num_to ||
			form.data.series_from > form.data.series_to
		) {
			form.errors.series_to = [
				`Series must stay within the ticket's own range (#${ticket.ticket_num_from} - #${ticket.ticket_num_to}).`
			];
			return message(
				form,
				{ type: 'error', text: 'The ticket series you entered is invalid.' },
				{ status: 400 }
			);
		}

		// Overlap against every existing assignment — the only check that
		// actually matters for correctness, and the one the old min/max logic
		// never performed at all. This is what makes gap-filling possible: any
		// range that fits inside a real gap passes, regardless of where that
		// gap sits relative to the highest currently-assigned series.
		const overlapping = ticket_assignments.find(
			(other) =>
				other.series_from <= form.data.series_to && other.series_to >= form.data.series_from
		);

		if (overlapping) {
			form.errors.series_to = [
				`This range overlaps assignment #${overlapping.series_from} - #${overlapping.series_to}.`
			];
			return message(
				form,
				{ type: 'error', text: 'The ticket series you entered overlaps an existing assignment.' },
				{ status: 400 }
			);
		}

		const create = await createTicketAssignment(form.data, locals.user);

		if (!create) {
			return message(form, {
				type: 'error',
				text: 'Currently cannot process your request. Please try again later.'
			});
		}

		return message(form, { type: 'success', text: 'User assigned successfully.' });
	}
};
