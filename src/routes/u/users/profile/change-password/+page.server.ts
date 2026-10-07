import { message, superValidate } from 'sveltekit-superforms';
import type { Actions, PageServerLoad } from './$types';
import { zod4 } from 'sveltekit-superforms/adapters';
import Login from '$lib/validation_schemas/Login.zod';
import { changePassword } from '$lib/server/services/Auth.service';
import { redirect } from 'sveltekit-flash-message/server';
import { resolve } from '$app/paths';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import { blockDemoPasswordChange } from '$lib/server/demo/guards';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(Login.ChangePasswordSchema));
	return { form };
};

export const actions: Actions = {
	change_password: async ({ request, locals, cookies }) => {
		const form = await superValidate(request, zod4(Login.ChangePasswordSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const demo_block = blockDemoPasswordChange(locals.user);
		if (demo_block) return message(form, { type: 'error', text: demo_block }, { status: 403 });

		const query = await changePassword(form.data, locals.user);
		if (!query.success) {
			return message(form, { type: 'error', text: query.message }, { status: 400 });
		}

		const log_data: T_Log_C = {
			level: 'INFO',
			type: 'EDIT',
			message: 'changed password',
			source: 'change password form action - change_password',
			affected_collection: {
				collection_name: 'users',
				document_id: [query.data._id.toString()]
			},
			user: logActor(locals.user)
		};

		await createLog(log_data);

		cookies.delete('bctms_auth_session', { path: '/' });
		redirect(303, resolve('/login'), { type: 'success', message: query.message }, cookies);
	}
};
