import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch, data }) => {
	const params = url.searchParams;
	const query = params.toString();

	if (!data.authorized)
		return {
			violation_categories: [],
			total_count: 0,
			...data
		};

	const _d = await fetch(resolve(`/api/violation-categories?${query}`));

	//if status NOT ok return blank and zero
	if (!_d.ok)
		return {
			violation_categories: [],
			total_count: 0,
			...data
		};

	const _data = await _d.json();

	return { violation_categories: _data, total_count: _d.headers.get('X-Total-Count'), ...data };
};
