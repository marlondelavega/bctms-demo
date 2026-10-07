import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { error } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import Violator from '$lib/validation_schemas/Violators.zod';
import type { PageLoad } from './$types';

// imported records often hold local numbers (09XXXXXXXXX); the form saves them as +63XXXXXXXXXX
const toPhilippineNumber = (value: unknown) => {
	if (value === null || value === undefined || value === '') return '';
	const digits = String(value).replace(/\D/g, '');
	if (/^0\d{10}$/.test(digits)) return `+63${digits.slice(1)}`;
	if (/^63\d{10}$/.test(digits)) return `+${digits}`;
	if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
	return String(value);
};

export const load: PageLoad = async ({ params, fetch }) => {
	const _u = await fetch(resolve('/api/violators/[id]', { id: params.id }));
	const violator: (Violator.Edit & { archived?: boolean }) | undefined = _u.ok
		? (await _u.json()).data
		: undefined;

	if (!violator) error(404, 'This violator could not be found.');

	const form = await superValidate(
		{ ...violator, contact_number: toPhilippineNumber(violator.contact_number) },
		zod4(Violator.EditSchema)
	);

	return { form, edit_id: params.id, archived: !!violator.archived };
};
