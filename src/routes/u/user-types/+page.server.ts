import { type Actions } from '@sveltejs/kit';
import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { PageServerLoad } from './$types';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import { permissions } from '$lib/utilities/helper';
import UserType from '$lib/validation_schemas/UserTypes.zod';
import { archiveUserTypes, restoreUserTypes } from '$lib/server/services/UserTypes.service';
import UserTypesModel from '$lib/server/models/UserTypes.model';
import { requireAccess, assertBatchOwnership } from '$lib/server/utilities/permissions.server';
import { blockDemoUserTypes } from '$lib/server/demo/guards';

const SCOPE_CONFIG = { ownField: 'created_by' };

//initialize the validation schema in server for user type, use load
export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	const archiveForm = await superValidate(zod4(UserType.ArchiveSchema), {
		id: 'userType_archiveForm'
	});
	const restoreForm = await superValidate(zod4(UserType.ArchiveSchema), {
		id: 'userType_restoreForm'
	});

	if (permissions.get('user_types', user?.user_type.permissions as string[]).access == 'none') {
		return {
			archiveForm,
			restoreForm,
			authorized: false,
			message: 'You do not meet the necessary permission to view data.'
		};
	}

	return {
		archiveForm,
		restoreForm,
		authorized: true,
		message: ''
	};
};

//user types actions
export const actions: Actions = {
	//archive user type
	archive: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(UserType.ArchiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const scope = requireAccess(locals.user, 'user_types', 'archive');
		await assertBatchOwnership(locals.user, scope, form.data._ids, UserTypesModel, SCOPE_CONFIG);

		const demo_block = await blockDemoUserTypes(form.data._ids);
		if (demo_block) return message(form, { type: 'error', text: demo_block }, { status: 403 });

		try {
			const _f = await archiveUserTypes(form.data._ids);

			if (_f.acknowledged) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'ARCHIVE',
					message: 'archived user types',
					source: 'user types form action - archive',
					affected_collection: {
						collection_name: 'user_types',
						document_id: form.data._ids
					},
					user: logActor(locals.user)
				};

				await createLog(log_data);
			}

			return message(form, { type: 'success', text: 'User type archived successfully.' });
		} catch (error) {
			if (error) return fail(400, { form });
		}
	},
	//restore user type
	restore: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(UserType.ArchiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const scope = requireAccess(locals.user, 'user_types', 'restore');
		await assertBatchOwnership(locals.user, scope, form.data._ids, UserTypesModel, SCOPE_CONFIG);

		try {
			const _f = await restoreUserTypes(form.data._ids);

			if (_f.acknowledged) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'RESTORE',
					message: 'restored user types',
					source: 'user types form action - restore',
					affected_collection: {
						collection_name: 'user_types',
						document_id: form.data._ids
					},
					user: logActor(locals.user)
				};

				await createLog(log_data);
			}

			return message(form, { type: 'success', text: 'User type restored successfully.' });
		} catch (error) {
			if (error) return fail(400, { form });
		}
	}
};
