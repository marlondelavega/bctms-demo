import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions } from '@sveltejs/kit';
import UserTypesModel from '$lib/server/models/UserTypes.model';
import { getUserType_byId, updateUserType } from '$lib/server/services/UserTypes.service';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import { redirect } from 'sveltekit-flash-message/server';
import UserType from '$lib/validation_schemas/UserTypes.zod';
import { resolve } from '$app/paths';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';
import { blockDemoUserTypes } from '$lib/server/demo/guards';

export const actions: Actions = {
	//edit user type
	edit: async ({ request, cookies, locals }) => {
		const form = await superValidate(request, zod4(UserType.EditSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const scope = requireAccess(locals.user, 'user_types', 'edit');
		const existing = await UserTypesModel.findById(form.data._id).lean();
		await assertOwnership(locals.user, scope, existing, { ownField: 'created_by' });

		const demo_block = await blockDemoUserTypes([form.data._id]);
		if (demo_block) return message(form, { type: 'error', text: demo_block }, { status: 403 });

		const _no_changes = await UserTypesModel.findOne({
			_id: form.data._id,
			user_type: form.data.user_type,
			role: form.data.role,
			permissions: form.data.permissions
		});

		const _found_existing = await UserTypesModel.findOne({
			user_type: form.data.user_type,
			_id: { $ne: form.data._id }
		});

		if (_no_changes) {
			return message(
				form,
				{
					type: 'error',
					text: 'No changes found. Please modify the form to update this user type.'
				},
				{ status: 400 }
			);
		} else if (_found_existing) {
			form.errors.user_type = ['Type of user already exists.'];
			return message(
				form,
				{
					type: 'error',
					text: 'Type of user already exists. Please try a different name.'
				},
				{ status: 400 }
			);
		}

		const _old = await getUserType_byId(form.data._id);

		const _f = await updateUserType(form.data);

		if (!_f) {
			return message(
				form,
				{
					type: 'error',
					text: 'Unexpected error, cannot edit user type. Please try again later.'
				},
				{ status: 400 }
			);
		} else if (_f) {
			const log_data: T_Log_C = {
				level: 'INFO',
				type: 'EDIT',
				message: 'edited user types',
				source: 'user types form action - edit',
				affected_collection: {
					collection_name: 'user_types',
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
			resolve('/u/user-types?page=1&size=10'),
			{ type: 'success', message: 'User type edited successfully.' },
			cookies
		);
	}
};
