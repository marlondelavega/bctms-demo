import { permissions } from '$lib/utilities/helper';
import { resolve } from '$app/paths';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import Payment from '$lib/validation_schemas/Payments.zod';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch, parent }) => {
	const { user } = await parent();
	const create_form = await superValidate(zod4(Payment.CreateSchema));

	if (permissions.get('payments', user.user_type.permissions as string[]).access == 'none') {
		return {
			payments: [],
			total_count: 0,
			message: 'You do not have the necessary permission to access this data.',
			authorized: false,
			form: { create_form: create_form }
		};
	}

	const params = url.searchParams;
	const searchparams = params.toString();

	const query = await fetch(resolve(`/api/payments?${searchparams}`));

	if (!query.ok) {
		return {
			payments: [],
			total_count: 0,
			message: 'Could not retrieve payments data.',
			authorized: true,
			form: { create_form: create_form }
		};
	}

	const data = await query.json();

	return {
		payments: data,
		total_count: query.headers.get('X-Total-Count'),
		message: 'Successfully retrieved payments.',
		authorized: true,
		form: { create_form: create_form }
	};
};
