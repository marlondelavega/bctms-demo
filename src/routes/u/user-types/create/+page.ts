import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data }) => {
	//return page load data
	return {
		...data
	};
};
