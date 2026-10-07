import { resolve } from '$app/paths';
import { permissions } from '$lib/utilities/helper';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch, parent }) => {
	const params = url.searchParams;
	const query = params.toString();
	const { user } = await parent();

	if (permissions.get('issuance', user?.user_type.permissions as string[]).access == 'none') {
		return {
			issuances: [],
			authorized: false,
			total_count: 0,
			message: 'You do not meet the necessary permission to view data.',
			user
		};
	}

	const _r = await fetch(resolve(`/api/issuances?${query}`));

	if (!_r.ok) {
		return {
			issuances: [],
			authorized: true,
			total_count: 0,
			message: 'Cannot retrieve issuance. Try again later.',
			user
		};
	}

	const _d = await _r.json();

	return {
		issuances: _d,
		authorized: true,
		total_count: _r.headers.get('X-Total-Count'),
		message: 'Successfully retrieved issuance.',
		user
	};
};
