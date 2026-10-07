import { message, superValidate } from 'sveltekit-superforms';
import type { Actions } from './$types';
import { zod4 } from 'sveltekit-superforms/adapters';
import CodeProvisionsModel from '$lib/server/models/CodeProvision.model';
import mongoose from 'mongoose';
import type { Penalty } from '$lib/server/models/CodeProvision.model';
import {
	getCodeProvision_byId,
	updateCodeProvision
} from '$lib/server/services/CodeProvisions.service';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import { redirect } from 'sveltekit-flash-message/server';
import CodeProvision from '$lib/validation_schemas/CodeProvisions.zod';
import { resolve } from '$app/paths';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';

type Comparable = {
	code?: string;
	description?: string;
	descriptor?: string;
	violation_category?: unknown;
	violation_sub_category?: unknown;
	enforcement_group?: unknown;
	penalty?: Penalty[];
};

// a stable string of every editable field, so a saved record and a submitted form can be compared
const comparable = (d: Comparable) =>
	JSON.stringify([
		d.code,
		d.description,
		d.descriptor ?? '',
		String(d.violation_category),
		String(d.violation_sub_category),
		String(d.enforcement_group),
		(d.penalty ?? []).map((p) => [
			p.pecuniary ?? 0,
			p.disciplinary ?? '',
			p.surcharge
				? [
						p.surcharge.type,
						p.surcharge.value,
						p.surcharge.applied_after_days,
						p.surcharge.applied_every_after
					]
				: null
		])
	]);

export const actions: Actions = {
	edit: async ({ request, cookies, locals }) => {
		const form = await superValidate(request, zod4(CodeProvision.EditSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Some fields need fixing. Check the highlighted fields.' },
				{ status: 400 }
			);
		}

		const edit_scope = requireAccess(locals.user, 'code_provisions', 'edit');
		const existing_provision = await CodeProvisionsModel.findById(form.data._id).lean();

		if (!existing_provision) {
			return message(
				form,
				{ type: 'error', text: 'This code provision no longer exists.' },
				{ status: 404 }
			);
		}

		await assertOwnership(locals.user, edit_scope, existing_provision, {
			ownField: 'created_by',
			officeField: 'enforcement_group'
		});

		// compared in code rather than as a Mongo filter, which would need the penalty sub-documents to
		// match field-for-field in the same order; the old filter also left out descriptor and group,
		// so changing only those was rejected as "no changes"
		const _no_changes =
			comparable(existing_provision as Comparable) ===
			comparable({ ...form.data, penalty: form.data.penalty as Penalty[] });

		const _found_existing = await CodeProvisionsModel.findOne({
			code: form.data.code,
			_id: { $ne: new mongoose.Types.ObjectId(form.data._id) }
		});

		if (_no_changes) {
			return message(
				form,
				{
					type: 'error',
					text: 'Nothing has changed yet. Edit a field before saving.'
				},
				{ status: 400 }
			);
		} else if (_found_existing) {
			form.errors.code = ['A code provision with this code already exists.'];
			return message(
				form,
				{
					type: 'error',
					text: `The code ${form.data.code} is already on record. Use a different code.`
				},
				{ status: 400 }
			);
		}

		const _old = await getCodeProvision_byId(form.data._id);

		const _f = await updateCodeProvision(form.data);

		if (_f) {
			const log_data: T_Log_C = {
				level: 'INFO',
				type: 'EDIT',
				message: 'edited code provision',
				source: 'code provision form action - edit',
				affected_collection: {
					collection_name: 'code_provisions',
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

		redirect(
			resolve('/u/code-provisions?page=1&size=10'),
			{ type: 'success', message: `${form.data.code} was updated.` },
			cookies
		);
	}
};
