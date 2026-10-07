import { fail, message, superValidate } from 'sveltekit-superforms';
import type { PageServerLoad } from './$types';
import { zod4 } from 'sveltekit-superforms/adapters';
import { type Actions } from '@sveltejs/kit';
import {
	archiveCodeProvisions,
	restoreCodeProvisions
} from '$lib/server/services/CodeProvisions.service';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import { permissions } from '$lib/utilities/helper';
import CodeProvision from '$lib/validation_schemas/CodeProvisions.zod';
import CodeProvisionsModel from '$lib/server/models/CodeProvision.model';
import { requireAccess, assertBatchOwnership } from '$lib/server/utilities/permissions.server';

const SCOPE_CONFIG = { ownField: 'created_by', officeField: 'enforcement_group' };

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	const archive_form = await superValidate(zod4(CodeProvision.ArchiveSchema), {
		id: 'archive_form'
	});
	const restore_form = await superValidate(zod4(CodeProvision.ArchiveSchema), {
		id: 'restore_form'
	});

	if (
		permissions.get('code_provisions', user?.user_type.permissions as string[]).access == 'none'
	) {
		return {
			archive_form,
			restore_form,
			authorized: false,
			message: 'You do not meet the necessary permission to view data.'
		};
	}

	return {
		archive_form,
		restore_form,
		authorized: true,
		message: ''
	};
};

export const actions: Actions = {
	archive: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(CodeProvision.ArchiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const archive_scope = requireAccess(locals.user, 'code_provisions', 'archive');
		await assertBatchOwnership(
			locals.user,
			archive_scope,
			form.data._ids,
			CodeProvisionsModel,
			SCOPE_CONFIG
		);

		try {
			const _f = await archiveCodeProvisions(form.data._ids);

			if (_f.acknowledged) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'ARCHIVE',
					message: 'archived code provision',
					source: 'code provision action - archive',
					affected_collection: {
						collection_name: 'code_provisions',
						document_id: form.data._ids
					},
					user: logActor(locals.user)
				};

				await createLog(log_data);
			}

			return message(form, { type: 'success', text: 'Code provisions archived successfully.' });
		} catch (error) {
			if (error) return fail(400, { form });
		}
	},

	restore: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(CodeProvision.ArchiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const restore_scope = requireAccess(locals.user, 'code_provisions', 'restore');
		await assertBatchOwnership(
			locals.user,
			restore_scope,
			form.data._ids,
			CodeProvisionsModel,
			SCOPE_CONFIG
		);

		try {
			const _f = await restoreCodeProvisions(form.data._ids);

			if (_f.acknowledged) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'RESTORE',
					message: 'restored code provisions',
					source: 'code provision action - restore',
					affected_collection: {
						collection_name: 'code_provisions',
						document_id: form.data._ids
					},
					user: logActor(locals.user)
				};

				await createLog(log_data);
			}

			return message(form, { type: 'success', text: 'Code provisions restored successfully.' });
		} catch (error) {
			if (error) return fail(400, { form });
		}
	}
};
