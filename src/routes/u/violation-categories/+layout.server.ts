import { permissions } from '$lib/utilities/helper';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
	const { user } = await parent();
	if (!permissions.hasAccess('violation_categories', user?.user_type.permissions as string[])) {
		error(401, 'Access denied');
	}
};
