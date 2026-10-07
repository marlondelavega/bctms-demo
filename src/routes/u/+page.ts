import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

export const load = async () => {
	redirect(303, resolve('/u/dashboard'));
};
