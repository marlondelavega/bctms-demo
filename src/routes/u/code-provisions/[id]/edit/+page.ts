import { resolve } from '$app/paths';
import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import type { PageLoad } from './$types';
import { zod4 } from 'sveltekit-superforms/adapters';
import CodeProvision from '$lib/validation_schemas/CodeProvisions.zod';

export const load: PageLoad = async ({ fetch, params }) => {
	const _f = await fetch(resolve(`/api/code-provisions/${params.id}`));
	const _d = _f.ok ? await _f.json() : null;

	if (!_d?.data) error(404, 'This code provision could not be found.');

	const editForm = await superValidate(_d.data, zod4(CodeProvision.EditSchema));

	return { editForm };
};
