import { resolve } from '$app/paths';
import { superValidate } from 'sveltekit-superforms';
import type { PageLoad } from './$types';
import { zod4 } from 'sveltekit-superforms/adapters';
import UserType from '$lib/validation_schemas/UserTypes.zod';

export const load: PageLoad = async ({ fetch, params }) => {
	const _u = await fetch(resolve(`/api/user-types/${params.id}`));
	const u_type = await _u.json();
	const editForm = await superValidate(u_type.data, zod4(UserType.EditSchema));

	return { editForm };
};
