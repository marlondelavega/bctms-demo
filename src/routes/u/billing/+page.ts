import { permissions } from '$lib/utilities/helper';
import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch, parent }) => {
	const params = url.searchParams;
	const query = params.toString();
	const { user } = await parent();

	if (permissions.get('billing', user.user_type.permissions as string[]).access == 'none') {
		return {
			billings: [],
			authorized: false,
			total_count: 0,
			message: 'You do not meet the necessary permission to view data.'
		};
	}

	const req = await fetch(resolve(`/api/billing?${query}`));

	if (!req.ok) {
		return {
			billings: [],
			authorized: false,
			total_count: 0,
			message: 'Cannot retrieve billings. Try again later.'
		};
	}

	const { data } = await req.json();

	return {
		billings: data,
		authorized: true,
		total_count: req.headers.get('X-Total-Count'),
		message: 'Successfully retrieved billings.'
	};
};
