import {
	changeIssuanceStatus,
	getIssuanceById,
	isIssuanceBalanceSettled
} from '$lib/server/services/Issuances.service';
import { getTicketTracking_byIssuance } from '$lib/server/services/TicketTracking.service';
import { getAllowedIssuanceStatusTransitions, issuance_status } from '$lib/data/static_data';
import { permissions } from '$lib/utilities/helper';
import type { Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import Issuance from '$lib/validation_schemas/Issuances.zod';
import IssuanceModel from '$lib/server/models/Issuance.model';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';

export const load: PageServerLoad = async ({ params, parent }) => {
	const _id = params.id;
	const { user } = await parent();
	const change_status_form = await superValidate(zod4(Issuance.ChangeStatusSchema));

	if (permissions.get('issuance', user?.user_type.permissions as string[]).access == 'none') {
		return {
			issuance: {},
			tracking: [],
			balance_settled: false,
			forms: {
				change_status: change_status_form
			},
			authorized: false,
			total_count: 0,
			message: 'You do not meet the necessary permission to view data.'
		};
	}

	const query = await getIssuanceById(_id);

	if (!query) {
		return {
			issuance: {},
			tracking: [],
			balance_settled: false,
			forms: {
				change_status: change_status_form
			},
			authorized: true,
			total_count: 0,
			message: 'Cannot retrieve issuances. Try again later.'
		};
	}

	const tracking_data = await getTicketTracking_byIssuance(query._id);
	const { settled: balance_settled } = await isIssuanceBalanceSettled(query._id.toString());

	return {
		issuance: JSON.parse(JSON.stringify(query)),
		tracking: JSON.parse(JSON.stringify(tracking_data)),
		balance_settled,
		forms: {
			change_status: change_status_form
		},
		authorized: true,
		total_count: 0,
		message: 'Successfully retrieved issuance.'
	};
};

export const actions: Actions = {
	change_status: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(Issuance.ChangeStatusSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const find_id = await IssuanceModel.findById(form.data.issuance_id).lean();

		if (!find_id) {
			return message(form, { type: 'error', text: 'Issuance not found.' }, { status: 400 });
		}

		const scope = requireAccess(locals.user, 'issuance', 'edit');
		await assertOwnership(locals.user, scope, find_id, { ownField: 'issuer' });

		const allowed = getAllowedIssuanceStatusTransitions((find_id as { status: number }).status);
		if (!allowed.includes(form.data.status as (typeof allowed)[number])) {
			return message(
				form,
				{ type: 'error', text: 'That status change is not allowed from the current status.' },
				{ status: 400 }
			);
		}

		if (form.data.status === issuance_status.PAID) {
			const { settled, reason } = await isIssuanceBalanceSettled(form.data.issuance_id);
			if (!settled) {
				return message(
					form,
					{ type: 'error', text: reason ?? 'This ticket cannot be marked Paid yet.' },
					{ status: 400 }
				);
			}
		}

		const query = await changeIssuanceStatus(form.data, locals.user);

		if (!query) {
			return message(
				form,
				{ type: 'error', text: 'Failed to change issuance status.' },
				{ status: 400 }
			);
		}

		const log_data: T_Log_C = {
			level: 'INFO',
			type: 'EDIT',
			message: 'changed issuance status',
			source: 'issuance status form action - change_status',
			affected_collection: {
				collection_name: 'issuances',
				document_id: [query._id.toString()]
			},
			user: logActor(locals.user),
			metadata: {
				from: find_id,
				to: query
			}
		};

		await createLog(log_data);

		return message(form, { type: 'success', text: 'Successfully changed issuance status.' });
	}
};
