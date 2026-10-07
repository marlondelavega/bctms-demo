import type { PageLoad } from './$types';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import Login from '$lib/validation_schemas/Login.zod';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

export const load: PageLoad = async ({ data }) => {
	if (data.user) {
		throw redirect(303, resolve('/u'));
	}
	const login_form = await superValidate(zod4(Login.Schema));

	return { login_form, demo_accounts: data.demo_accounts };
};
