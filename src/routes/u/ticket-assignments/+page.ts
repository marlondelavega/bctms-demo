import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch, data }) => {
	const params = url.searchParams;
	const query = params.toString();

	if (!data.authorized) {
		return {
			tickets: [],
			total_count: 0,
			...data
		};
	}

	//fetch
	const _r = await fetch(resolve(`/api/ticket-assignments?${query}`));

	if (!_r.ok) {
		return {
			tickets: [],
			total_count: 0,
			...data
		};
	}

	const _d = await _r.json();

	return {
		tickets: _d,
		total_count: _r.headers.get('X-Total-Count'),
		...data
	};
};
