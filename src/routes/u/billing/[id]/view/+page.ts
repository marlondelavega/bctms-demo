import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const req = await fetch(resolve(`/api/billing/${params.id}`));
	const billing_data = await req.json();

	return { billing: { ...billing_data.data } };
};
