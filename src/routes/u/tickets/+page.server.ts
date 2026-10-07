import { fail, message, superValidate } from 'sveltekit-superforms';
import type { PageServerLoad } from './$types';
import { zod4 } from 'sveltekit-superforms/adapters';
import Ticket from '$lib/validation_schemas/Tickets.zod';
import type { Actions } from '@sveltejs/kit';
import TicketsModel from '$lib/server/models/Tickets.model';
import {
	archiveTickets,
	availableTickets,
	createTicket,
	getTicket_byId,
	restoreTickets,
	updateManyTickets,
	updateTicket
} from '$lib/server/services/Tickets.service';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import mongoose from 'mongoose';
import { permissions } from '$lib/utilities/helper';
import {
	requireAccess,
	assertOwnership,
	assertBatchOwnership
} from '$lib/server/utilities/permissions.server';

const SCOPE_CONFIG = { ownField: 'created_by', officeField: 'ticket_for' };

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	const createForm = await superValidate(zod4(Ticket.CreateSchema));
	const editForm = await superValidate(zod4(Ticket.EditSchema));
	const withdrawForm = await superValidate(zod4(Ticket.WithdrawSchema));
	const archiveForm = await superValidate(zod4(Ticket.ArchiveSchema), { id: 'archive' });
	const restoreForm = await superValidate(zod4(Ticket.ArchiveSchema), { id: 'restore' });

	if (permissions.get('tickets', user?.user_type.permissions as string[]).access == 'none') {
		return {
			createForm,
			editForm,
			withdrawForm,
			archiveForm,
			restoreForm,
			authorized: false,
			message: 'You do not meet the necessary permission to view data.'
		};
	}

	return {
		createForm,
		editForm,
		withdrawForm,
		archiveForm,
		restoreForm,
		authorized: true,
		message: ''
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requireAccess(locals.user, 'tickets', 'create');

		//validate using superValidate
		const form = await superValidate(request, zod4(Ticket.CreateSchema));

		//return message with status 400 if NOT valid
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		try {
			const _found_existing = await TicketsModel.findOne({ name: form.data.name });

			if (_found_existing) {
				form.errors.name = ['A ticket with this name already exists.'];

				return message(
					form,
					{
						type: 'error',
						text: 'Ticket already exists. Please try a different name.'
					},
					{ status: 400 }
				);
			}

			const _f = await createTicket(form.data, locals.user);

			if (_f) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'CREATE',
					message: 'created ticket',
					source: 'ticket form action - create',
					affected_collection: {
						collection_name: 'tickets',
						document_id: [_f._id.toString()]
					},
					user: logActor(locals.user)
				};

				await createLog(log_data);
			}

			return message(form, { type: 'success', text: 'Ticket created successfully.' });
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (error) {
			return fail(400, { form });
		}
	},

	edit: async ({ request, locals }) => {
		//validate using superValidate
		const form = await superValidate(request, zod4(Ticket.EditSchema));

		//return message with status 400 if not valid
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const scope = requireAccess(locals.user, 'tickets', 'edit');
		const existing_ticket = await TicketsModel.findById(form.data._id).lean();
		await assertOwnership(locals.user, scope, existing_ticket, SCOPE_CONFIG);

		const _found_existing = await TicketsModel.findOne({
			name: form.data.name,
			_id: { $ne: new mongoose.Types.ObjectId(form.data._id) }
		});

		if (_found_existing) {
			form.errors.name = ['A ticket with this name already exists.'];

			return message(
				form,
				{ type: 'error', text: 'Ticket already exists. Please try a different name.' },
				{ status: 400 }
			);
		}

		const _no_changes = await TicketsModel.findOne({
			_id: new mongoose.Types.ObjectId(form.data._id),
			name: form.data.name,
			date_created: form.data.date_created,
			date_withdrawn: form.data.date_withdrawn,
			withdraw: form.data.withdraw,
			ticket_num_from: form.data.ticket_num_from,
			ticket_num_to: form.data.ticket_num_to,
			ticket_for: form.data.ticket_for,
			in_charge: form.data.in_charge
		});

		if (_no_changes) {
			return message(
				form,
				{
					type: 'error',
					text: 'No changes found. Please modify the form to update this ticket.'
				},
				{ status: 400 }
			);
		}

		const _old = await getTicket_byId(form.data._id);

		const _f = await updateTicket(form.data);

		if (_f) {
			const log_data: T_Log_C = {
				level: 'INFO',
				type: 'EDIT',
				message: 'edited ticket',
				source: 'ticket form action - edit',
				affected_collection: {
					collection_name: 'tickets',
					document_id: [_f._id.toString()]
				},
				user: logActor(locals.user),
				metadata: {
					from: _old,
					to: _f
				}
			};

			await createLog(log_data);
		}

		return message(form, { type: 'success', text: 'Ticket edited successfully.' });
	},

	withdraw: async ({ request, locals }) => {
		//validate form
		const form = await superValidate(request, zod4(Ticket.WithdrawSchema));

		//return message with status 400 if not valid
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const withdraw_scope = requireAccess(locals.user, 'tickets', 'edit');
		await assertBatchOwnership(
			locals.user,
			withdraw_scope,
			form.data._ids,
			TicketsModel,
			SCOPE_CONFIG
		);

		const _f = await updateManyTickets(form.data);

		if (_f) {
			const log_data: T_Log_C = {
				level: 'INFO',
				type: 'EDIT',
				message: 'withdrawn ticket',
				source: 'ticket form action - withdrawn',
				affected_collection: {
					collection_name: 'tickets',
					document_id: form.data._ids
				},
				user: logActor(locals.user)
			};

			await createLog(log_data);
		}

		return message(form, { type: 'success', text: 'Ticket withdrawn successfully.' });
	},

	archive: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(Ticket.ArchiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const archive_scope = requireAccess(locals.user, 'tickets', 'archive');
		await assertBatchOwnership(
			locals.user,
			archive_scope,
			form.data._ids,
			TicketsModel,
			SCOPE_CONFIG
		);

		const _a = await availableTickets(form.data._ids);

		if (!_a || !_a.length) {
			return message(
				form,
				{
					type: 'error',
					text: 'Error: There are no tickets to archive. Please select archivable tickets.'
				},
				{ status: 400 }
			);
		}

		const _ids = _a.map((d) => d._id);

		const _f = await archiveTickets(_ids);

		if (!_f) {
			return message(
				form,
				{
					type: 'error',
					text: 'Cannot process your request. Please try again later.'
				},
				{ status: 400 }
			);
		} else if (_f.acknowledged) {
			const log_data: T_Log_C = {
				level: 'INFO',
				type: 'ARCHIVE',
				message: 'archived tickets',
				source: 'tickets action - archive',
				affected_collection: {
					collection_name: 'tickets',
					document_id: _ids
				},
				user: logActor(locals.user)
			};

			await createLog(log_data);
		}

		return message(form, { type: 'success', text: 'Tickets archived successfully.' });
	},

	restore: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(Ticket.ArchiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const restore_scope = requireAccess(locals.user, 'tickets', 'restore');
		await assertBatchOwnership(
			locals.user,
			restore_scope,
			form.data._ids,
			TicketsModel,
			SCOPE_CONFIG
		);

		const _f = await restoreTickets(form.data._ids);

		if (!_f) {
			return message(
				form,
				{
					type: 'error',
					text: 'Cannot process your request. Please try again later.'
				},
				{ status: 400 }
			);
		} else if (_f.acknowledged) {
			const log_data: T_Log_C = {
				level: 'INFO',
				type: 'RESTORE',
				message: 'restored tickets',
				source: 'tickets action - restore',
				affected_collection: {
					collection_name: 'tickets',
					document_id: form.data._ids
				},
				user: logActor(locals.user)
			};

			await createLog(log_data);
		}

		return message(form, { type: 'success', text: 'Tickets restored successfully.' });
	}
};
