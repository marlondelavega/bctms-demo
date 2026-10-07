import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch, data }) => {
	const params = url.searchParams;
	const query = params.toString();

	if (!data.authorized)
		return {
			user_types: [],
			total_count: 0,
			...data
		};

	//fetch func
	const _r = await fetch(resolve(`/api/user-types?${query}`));

	if (!_r.ok) {
		//if status NOT ok return blank and zero
		return {
			user_types: [],
			total_count: 0,
			...data
		};
	}

	//if status ok execute this instead
	//transform response _r to json, await
	const _eg = await _r.json();

	//return page load data
	return {
		user_types: _eg,
		total_count: _r.headers.get('X-Total-Count'),
		//this data is from server load
		...data
	};
};
