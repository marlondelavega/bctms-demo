import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { resolve } from '$app/paths';
import Payment from '$lib/validation_schemas/Payments.zod';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const _r = await fetch(resolve(`/api/payments/${params.id}`));
	const _d = await _r.json();
	const payment = _d.data;

	const form = await superValidate(
		{
			...payment,
			issuance: typeof payment?.issuance === 'object' ? payment.issuance._id : payment?.issuance,
			billing: typeof payment?.billing === 'object' ? payment.billing._id : payment?.billing
		},
		zod4(Payment.EditSchema)
	);

	return { form, edit_id: params.id, payment };
};
