import { message, superValidate } from 'sveltekit-superforms';
import type { PageServerLoad } from './$types';
import { zod4 } from 'sveltekit-superforms/adapters';
import Issuance from '$lib/validation_schemas/Issuances.zod';
import type { Actions } from '@sveltejs/kit';
import CodeProvisionsModel, {
	type BillingSurcharge,
	type Penalty
} from '$lib/server/models/CodeProvision.model';
import { createIssuance } from '$lib/server/services/Issuances.service';
import IssuanceModel from '$lib/server/models/Issuance.model';
import type CodeProvision from '$lib/validation_schemas/CodeProvisions.zod';
import type ViolationCategory from '$lib/validation_schemas/ViolationCategories.zod';
import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
import type TicketAssignment from '$lib/validation_schemas/TicketAssignments.zod';
import type User from '$lib/validation_schemas/Users.zod';
import type Violator from '$lib/validation_schemas/Violators.zod';
import { resolve } from '$app/paths';
import { customAlphabet } from 'nanoid';
import { requireAccess } from '$lib/server/utilities/permissions.server';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';

export const load: PageServerLoad = async ({ url, fetch }) => {
	const reissued_from = url.searchParams.get('reissue');
	const form = await superValidate(zod4(Issuance.CreateSchema));

	if (reissued_from) {
		const query = await fetch(resolve(`/api/issuances/${reissued_from}`));
		const { data }: { data: Issuance.Base<TicketAssignment.Base, User.Base, Violator.Base> } =
			await query.json();

		return { form: form, reissue_data: data };
	}

	return { form };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requireAccess(locals.user, 'issuance', 'create');

		const form = await superValidate(request, zod4(Issuance.CreateSchema));

		const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
		const tid = customAlphabet(alphabet, 8);
		const tracking_code = `I${new Date(form.data.apprehension_date).getFullYear()}-${tid()}`;

		form.data.tracking_code = tracking_code;

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Some details need fixing before this ticket can be issued.' },
				{ status: 400 }
			);
		}

		const provisions = await CodeProvisionsModel.find<
			CodeProvision.Base<
				string,
				ViolationCategory.Base,
				EnforcementGroup.Base,
				Penalty<BillingSurcharge>[]
			>
		>({ _id: { $in: form.data.violations } })
			.populate('violation_category')
			.populate('enforcement_group');

		const resolved_penalty = await _resolveAllViolationPenalties(provisions, form.data.recipient);

		const violations = resolved_penalty.map(({ provision, penalty, level }) =>
			_mapProvisionToViolationSnapshot(provision, penalty, level)
		);
		let issuer: string;
		if (form.data.issuer) {
			issuer = form.data.issuer;
		} else {
			issuer = locals.user._id;
		}

		const issuance_query = await createIssuance(form.data, violations, issuer);

		if (!issuance_query) {
			return message(
				form,
				{ type: 'error', text: 'Cannot process issuance at the moment, please try again later' },
				{ status: 400 }
			);
		}

		const log_data: T_Log_C = {
			level: 'INFO',
			type: 'CREATE',
			message: 'created issuance',
			source: 'issuance form action - create',
			affected_collection: {
				collection_name: 'issuances',
				document_id: [issuance_query._id.toString()]
			},
			user: logActor(locals.user)
		};

		await createLog(log_data);

		// the page shows a receipt instead of redirecting, so the officer sees the tracking code
		return message(form, {
			type: 'success',
			text: 'Ticket issued',
			data: { _id: issuance_query._id.toString(), tracking_code }
		});
	}
};

export async function _resolveAllViolationPenalties(
	provisions: CodeProvision.Base<
		string,
		ViolationCategory.Base,
		EnforcementGroup.Base,
		Penalty<BillingSurcharge>[]
	>[],
	recipientId: string
) {
	// single query to get all existing issuances for this recipient
	const existing_issuances = await IssuanceModel.find({
		status: { $ne: 6 },
		recipient: recipientId,
		'violations.code_provision': { $in: provisions.map((p) => p._id) }
	});

	// group by code_provision for O(1) lookup
	const issuanceCountMap = existing_issuances.reduce<Record<string, number>>((acc, issuance) => {
		for (const v of issuance.violations) {
			const key = v.code_provision.toString();
			acc[key] = (acc[key] ?? 0) + 1;
		}
		return acc;
	}, {});

	return provisions.map((provision) => {
		const count = issuanceCountMap[provision._id.toString()] ?? 0;
		const raw = provision.penalty[count] ?? provision.penalty.at(-1);

		return {
			provision,
			level: count + 1,
			penalty: {
				pecuniary: raw?.pecuniary ?? 0,
				disciplinary: raw?.disciplinary ?? '',
				surcharge: raw?.surcharge ?? {
					type: null,
					value: 0,
					applied_after_days: 0,
					applied_every_after: 0,
					surcharge_due_date: null,
					surcharge_applied_date: null,
					surcharge_amount: 0
				}
			}
		};
	});
}

export type ResolvedViolation = Awaited<ReturnType<typeof _resolveAllViolationPenalties>>[number];

export function _mapProvisionToViolationSnapshot(
	provision: CodeProvision.Base<
		string,
		ViolationCategory.Base,
		EnforcementGroup.Base,
		Penalty<BillingSurcharge>[]
	>,
	penalty: ResolvedViolation['penalty'],
	level: number
) {
	const sub_category = provision.violation_category.sub_categories.find((sub) => {
		return sub._id.toString() === provision.violation_sub_category.toString();
	});

	return {
		code_provision: provision._id,
		code: provision.code,
		description: provision.description,
		descriptor: provision.descriptor,
		penalty,
		level,
		violation_category: {
			name: provision.violation_category.name,
			description: provision.violation_category.description
		},
		violation_sub_category: {
			name: sub_category?.name ?? ''
		},
		enforcement_group: {
			name: provision.enforcement_group.name,
			description: provision.enforcement_group.description
		}
	};
}
