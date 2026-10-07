import { resolve } from '$app/paths';
import type { PageLoad, PageServerData } from './$types';
import type { URL } from 'url';

export const load: PageLoad = async ({
	url,
	fetch,
	data
}: {
	url: URL;
	fetch: App.Dev.SvelteFetch;
	data: PageServerData;
}) => {
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
	const _r = await fetch(resolve(`/api/tickets?${query}`));

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
