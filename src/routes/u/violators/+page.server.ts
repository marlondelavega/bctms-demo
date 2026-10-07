import { fail, message, superValidate } from 'sveltekit-superforms';
import type { PageServerLoad } from './$types';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions } from '@sveltejs/kit';
import { archiveViolators, restoreViolators } from '$lib/server/services/Violators.service';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { permissions } from '$lib/utilities/helper';
import { requireAccess, assertBatchOwnership } from '$lib/server/utilities/permissions.server';
import ViolatorsModel from '$lib/server/models/Violators.model';
import Violator from '$lib/validation_schemas/Violators.zod';

const SCOPE_CONFIG = { ownField: 'created_by' };

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();
	const archive_form = await superValidate(zod4(Violator.ArchiveSchema), { id: 'archive_form' });
	const restore_form = await superValidate(zod4(Violator.ArchiveSchema), { id: 'restore_form' });

	if (permissions.get('violators', user?.user_type.permissions as string[]).access == 'none') {
		return {
			archive_form,
			restore_form,
			authorized: false,
			message: 'You do not meet the necessary permission to view data.'
		};
	}

	return { archive_form, restore_form, authorized: true, message: '' };
};

export const actions: Actions = {
	archive: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(Violator.ArchiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const scope = requireAccess(locals.user, 'violators', 'archive');
		await assertBatchOwnership(locals.user, scope, form.data._ids, ViolatorsModel, SCOPE_CONFIG);

		try {
			const _f = await archiveViolators(form.data._ids);

			if (!_f.acknowledged) {
				return message(form, {
					type: 'error',
					text: 'There was a problem processing your request. Please try again later.'
				});
			}

			const log_data: T_Log_C = {
				level: 'INFO',
				type: 'ARCHIVE',
				message: 'archived violators',
				source: 'violators form action - archive',
				affected_collection: {
					collection_name: 'violators',
					document_id: form.data._ids
				},
				user: logActor(locals.user)
			};

			await createLog(log_data);

			return message(form, { type: 'success', text: 'Violator/s archived successfully.' });
		} catch (error) {
			if (error) {
				return fail(400, { form });
			}
			return fail(400, { form });
		}
	},

	restore: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(Violator.ArchiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const scope = requireAccess(locals.user, 'violators', 'restore');
		await assertBatchOwnership(locals.user, scope, form.data._ids, ViolatorsModel, SCOPE_CONFIG);

		try {
			const _f = await restoreViolators(form.data._ids);

			if (!_f.acknowledged) {
				return message(form, {
					type: 'error',
					text: 'There was a problem processing your request. Please try again later.'
				});
			}

			const log_data: T_Log_C = {
				level: 'INFO',
				type: 'RESTORE',
				message: 'restored violators',
				source: 'violators form action - restore',
				affected_collection: {
					collection_name: 'violators',
					document_id: form.data._ids
				},
				user: logActor(locals.user)
			};

			await createLog(log_data);

			return message(form, { type: 'success', text: 'Violator/s restored successfully.' });
		} catch (error) {
			if (error) {
				return fail(400, { form });
			}
			return fail(400, { form });
		}
	}
};
