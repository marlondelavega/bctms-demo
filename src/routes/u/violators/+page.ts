import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch, data }) => {
	const params = url.searchParams;
	const query = params.toString();

	if (!data.authorized)
		return {
			violators: [],
			total_count: 0,
			...data
		};

	//fetch func
	const _r = await fetch(resolve(`/api/violators?${query}`));

	//if status NOT ok return blank and zero
	if (!_r.ok)
		return {
			violators: [],
			total_count: 0,
			...data
		};

	//if status ok execute this instead
	//transform response _r to json, await
	const _d = await _r.json();

	//return page load data
	return {
		violators: _d,
		total_count: _r.headers.get('X-Total-Count'),
		...data
	};
};
