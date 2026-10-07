import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch, data }) => {
	const params = url.searchParams;
	const query = params.toString();

	if (!data.authorized) {
		//if status NOT ok return blank and zero
		return {
			users: [],
			total_count: 0,
			...data
		};
	}

	//fetch func
	const _r = await fetch(resolve(`/api/users?${query}`));

	if (!_r.ok) {
		//if status NOT ok return blank and zero
		return {
			users: [],
			total_count: 0,
			...data
		};
	}

	//if status ok execute this instead
	//transform response _r to json, await
	const _d = await _r.json();

	//return page load data
	return {
		users: _d,
		total_count: _r.headers.get('X-Total-Count'),
		...data
	};
};
