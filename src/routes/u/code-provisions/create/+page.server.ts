import { fail, message, superValidate } from 'sveltekit-superforms';
import type { PageServerLoad } from './$types';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions } from '@sveltejs/kit';
import CodeProvisionsModel from '$lib/server/models/CodeProvision.model';
import { createCodeProvision } from '$lib/server/services/CodeProvisions.service';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import CodeProvision from '$lib/validation_schemas/CodeProvisions.zod';
import { requireAccess } from '$lib/server/utilities/permissions.server';

export const load: PageServerLoad = async () => {
	const createForm = await superValidate(zod4(CodeProvision.CreateSchema), {
		defaults: {
			code: '',
			description: '',
			descriptor: '',
			enforcement_group: '',
			violation_category: '',
			violation_sub_category: '',
			penalty: [
				{ pecuniary: 0, disciplinary: '' },
				{ pecuniary: 0, disciplinary: '' },
				{ pecuniary: 0, disciplinary: '' }
			]
		}
	});

	return { createForm };
};

export const actions: Actions = {
	//create code provision
	create: async ({ request, locals }) => {
		requireAccess(locals.user, 'code_provisions', 'create');

		//validate input using superValidate
		const form = await superValidate(request, zod4(CodeProvision.CreateSchema));

		//if form is not valid: return an error message with status 400
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Some fields need fixing. Check the highlighted fields.' },
				{ status: 400 }
			);
		}

		try {
			//queries the database to find an existing document with the same code
			const _found_existing = await CodeProvisionsModel.findOne({ code: form.data.code });

			//if at least single document was found
			if (_found_existing) {
				//set errors.code with this specific error
				form.errors.code = ['This code already exists.'];
				//return the error message
				return message(
					form,
					{
						type: 'error',
						text: `The code ${form.data.code} is already on record. Use a different code.`
					},
					{ status: 400 }
				);
			}

			//create query with the form.data
			const _f = await createCodeProvision(form.data, locals.user);

			//if _f query does not succeed or there was an error, return error message
			if (!_f) {
				return message(
					form,
					{
						type: 'error',
						text: 'Unexpected error, could not create code provision. Please try again later.'
					},
					{ status: 400 }
				);
			} else if (_f) {
				//set the log data in an object
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'CREATE',
					message: 'created code provision',
					source: 'code provision form action - create',
					affected_collection: {
						collection_name: 'code_provisions',
						document_id: [_f._id.toString()]
					},
					user: logActor(locals.user)
				};

				//create log
				await createLog(log_data);
			}

			//return success message
			return message(form, {
				type: 'success',
				text: `${form.data.code} was added to the code provisions.`
			});
		} catch (error) {
			//if any of the try block fails: catch the error and return
			if (error) return fail(400, { form });
		}
	}
};
