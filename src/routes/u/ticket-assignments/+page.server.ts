import { permissions } from '$lib/utilities/helper';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	if (permissions.get('ticket_assignments', user?.user_type.permissions).access == 'none') {
		return {
			authorized: false,
			message: 'You do not meet the necessary permission to view data.'
		};
	}

	return {
		authorized: true,
		message: ''
	};
};
