import { type Actions } from '@sveltejs/kit';
import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { PageServerLoad } from './$types';
import { createUserType } from '$lib/server/services/UserTypes.service';
import UserType from '$lib/validation_schemas/UserTypes.zod';
import UserTypesModel from '$lib/server/models/UserTypes.model';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import { requireAccess } from '$lib/server/utilities/permissions.server';

//initialize the validation schema in server for user type, use load
export const load: PageServerLoad = async () => {
	const createForm = await superValidate(zod4(UserType.CreateSchema));

	return { createForm };
};

//user types actions
export const actions: Actions = {
	//create user type
	create: async ({ request, locals }) => {
		requireAccess(locals.user, 'user_types', 'create');

		//validate using superValidate
		const form = await superValidate(request, zod4(UserType.CreateSchema));

		form.data.permissions = form.data.permissions?.filter((val) => val.trim().length > 0);

		//return message with status 400 if NOT valid
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		try {
			const _found_existing = await UserTypesModel.findOne({ user_type: form.data.user_type });

			if (_found_existing) {
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
			//create new user type document
			const _f = await createUserType(form.data, locals.user);

			if (!_f) {
				return message(
					form,
					{
						type: 'error',
						text: 'Unexpected error, could not create user type. Please try again later.'
					},
					{ status: 400 }
				);
			} else if (_f) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'CREATE',
					message: 'created user types',
					source: 'user type form action - create',
					affected_collection: {
						collection_name: 'user_types',
						document_id: [_f._id.toString()]
					},
					user: logActor(locals.user)
				};

				await createLog(log_data);
			}

			//return success using message()
			return message(form, { type: 'success', text: 'User type created successfully.' });
		} catch (error) {
			//if all else fails return fail()
			if (error) return fail(400, { form });
		}
	}
};
