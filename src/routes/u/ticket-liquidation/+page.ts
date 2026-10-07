import { permissions } from '$lib/utilities/helper';
import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch, parent }) => {
	const { user } = await parent();
	if (
		permissions.get('ticket_liquidation', user.user_type.permissions as string[]).access == 'none'
	) {
		return {
			tickets: [],
			total_count: 0,
			message: 'You do not have the necessary permission to access this data.',
			authorized: false
		};
	}

	const params = url.searchParams;
	const searchparams = params.toString();

	const query = await fetch(resolve(`/api/tickets/withdrawn?${searchparams}`));

	if (!query.ok) {
		return {
			tickets: [],
			total_count: 0,
			message: 'Could not retrieve ticket liquidation data.',
			authorized: true
		};
	}

	const data = await query.json();

	return {
		tickets: data,
		total_count: query.headers.get('X-Total-Count'),
		message: 'Successfully retrieved ticket liquidation data.',
		authorized: true
	};
};
