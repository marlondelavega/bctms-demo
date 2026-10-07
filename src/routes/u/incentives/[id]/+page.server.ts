import { error, type Actions } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getIncentiveReport, voidIncentiveReport } from '$lib/server/services/Incentives.service';
import Incentive from '$lib/validation_schemas/Incentives.zod';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) error(401, 'Access denied');

	const [result, voidForm] = await Promise.all([
		getIncentiveReport(locals.user, params.id),
		superValidate({ _id: params.id, reason: '' }, zod4(Incentive.VoidSchema), { errors: false })
	]);

	return { ...result, voidForm };
};

export const actions: Actions = {
	void: async ({ request, locals }) => {
		if (!locals.user) error(401, 'Access denied');
		const form = await superValidate(request, zod4(Incentive.VoidSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Give a reason for voiding.' }, { status: 400 });
		}

		const { already } = await voidIncentiveReport(locals.user, form.data);
		return message(form, {
			type: 'success',
			text: already
				? 'This report was already voided.'
				: 'Report voided. Its tickets can now be counted in a new report.'
		});
	}
};
