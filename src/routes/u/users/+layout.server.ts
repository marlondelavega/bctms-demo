import { permissions } from '$lib/utilities/helper';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent, route }) => {
	// your own profile (and the forced change-password page) must work without access to the users module
	if (route.id?.startsWith('/u/users/profile')) return;

	const { user } = await parent();
	if (!permissions.hasAccess('users', user?.user_type.permissions as string[])) {
		throw error(401, 'Access denied');
	}
};
