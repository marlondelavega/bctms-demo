import { error, redirect, type Actions } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { message, superValidate, type SuperValidated } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import {
	buildIncentives,
	generateIncentiveReport,
	getGenerateOptions,
	type BuildFailure
} from '$lib/server/services/Incentives.service';
import { date, multiParam } from '$lib/utilities/helper';
import Incentive from '$lib/validation_schemas/Incentives.zod';
import type { PageServerLoad } from './$types';

type Form = SuperValidated<Incentive.Generate, App.Superforms.Message>;

/** Puts the service's per-field errors (e.g. `settings[2].override_reason`) onto the form. */
function applyFailure(form: Form, failure: BuildFailure) {
	form.valid = false;
	for (const e of failure.field_errors ?? []) {
		const m = /^settings\[(\d+)\]\.(\w+)$/.exec(e.path);
		if (!m) continue;
		const settings = (form.errors.settings ??= {}) as Record<number, Record<string, string[]>>;
		(settings[Number(m[1])] ??= {})[m[2]] = [e.message];
	}
	return message(form, { type: 'error', text: failure.message }, { status: 400 });
}

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) error(401, 'Access denied');

	const options = await getGenerateOptions(locals.user);
	const params = url.searchParams;

	// incentives are usually paid out per month, so start on the previous full month
	const now = new Date();
	const last_month_start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	const last_month_end = new Date(now.getFullYear(), now.getMonth(), 0);

	const known = (ids: string[], list: { _id: string }[]) =>
		ids.filter((id) => list.some((o) => o._id === id));

	// a ?enforcement_group= link pre-selects those groups; otherwise groups with an active saved
	// rate start included. Either way every group the person may pay gets a rates row — choosing
	// groups happens on the rates cards, not in a separate filter.
	const picked_groups = known(multiParam(params, 'enforcement_group'), options.groups);

	const form = await superValidate(
		{
			date_from: params.get('date_from') || date.dateToString(last_month_start),
			date_to: params.get('date_to') || date.dateToString(last_month_end),
			enforcement_group: [],
			issuer: known(multiParam(params, 'issuer'), options.users),
			user_type: known(multiParam(params, 'user_type'), options.user_types),
			violation_category: known(multiParam(params, 'violation_category'), options.categories),
			code_provision: known(multiParam(params, 'code_provision'), options.provisions),
			barangay: params.get('barangay')?.trim() ?? '',
			// old-system tickets are included unless a link says otherwise (?include_legacy=0)
			exclude_legacy: params.get('include_legacy') === '0',
			// one rates row per group, pre-filled from the group's saved incentive settings
			settings: options.groups.map((g) => ({
				group: g._id,
				include: picked_groups.length ? picked_groups.includes(g._id) : !!g.incentive?.enabled,
				rate_type: g.incentive?.rate_type ?? 'percentage',
				amount: g.incentive?.amount ?? 0,
				basis: g.incentive?.basis ?? 'paid',
				override_reason: ''
			})),
			excluded: [],
			remarks: ''
		},
		zod4(Incentive.GenerateSchema),
		{ errors: false }
	);

	return { options, form };
};

export const actions: Actions = {
	preview: async ({ request, locals }) => {
		if (!locals.user) error(401, 'Access denied');
		// lenient: blank reasons don't block a preview, only generating
		const form = await superValidate(request, zod4(Incentive.PreviewSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Some details need fixing.' }, { status: 400 });
		}

		const built = await buildIncentives(locals.user, form.data, { require_reasons: false });
		if (!built.ok) return applyFailure(form as unknown as Form, built);

		return message(form, { type: 'action', text: 'preview', data: built.preview });
	},

	generate: async ({ request, locals }) => {
		if (!locals.user) error(401, 'Access denied');
		const form = await superValidate(request, zod4(Incentive.GenerateSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Some details need fixing.' }, { status: 400 });
		}

		const result = await generateIncentiveReport(locals.user, form.data);
		if (!result.ok) return applyFailure(form, result);

		redirect(303, `${resolve('/u/incentives/[id]', { id: result._id })}?generated=1`);
	}
};
