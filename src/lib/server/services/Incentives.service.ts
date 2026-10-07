import mongoose from 'mongoose';
import { error } from '@sveltejs/kit';
import { customAlphabet } from 'nanoid';
import IssuanceModel from '$lib/server/models/Issuance.model';
import BillingModel from '$lib/server/models/Billing.model';
import PaymentModel from '$lib/server/models/Payments.model';
import UsersModel from '$lib/server/models/Users.model';
import UserTypesModel from '$lib/server/models/UserTypes.model';
import EnforcementGroupsModel from '$lib/server/models/EnforcementGroups.model';
import ViolationCategoryModel from '$lib/server/models/ViolationCategories.model';
import CodeProvisionsModel from '$lib/server/models/CodeProvision.model';
import IncentiveReportsModel from '$lib/server/models/IncentiveReports.model';
import IncentiveReportItemsModel from '$lib/server/models/IncentiveReportItems.model';
import type { permission_scope } from '$lib/server/models/UserTypes.model';
import { requireAccess, type ScopedUser } from '$lib/server/utilities/permissions.server';
import { issuance_status } from '$lib/data/static_data';
import { escapeRegex, multiParam, parseSearchParams, toObjectId } from '$lib/utilities/helper';
import { incentiveFor, round2, sameRate, summarize, totalsOf } from '$lib/utilities/incentives';
import type Incentive from '$lib/validation_schemas/Incentives.zod';
import { createLog, logActor } from './Logs.service';

type Id = mongoose.Types.ObjectId;

/** The signed-in user as the routes hand it over (locals.user). */
export type Actor = ScopedUser & {
	firstname?: string;
	lastname?: string;
	username?: string;
	user_type: { permissions: string[]; user_type?: string };
};

const objectIds = (values: string[]) =>
	values.map((v) => toObjectId(v)).filter((v): v is Id => !!v);

const plain = <T>(value: unknown): T => JSON.parse(JSON.stringify(value));

const fullName = (u?: { firstname?: string; lastname?: string } | null) =>
	[u?.firstname, u?.lastname].filter(Boolean).join(' ').trim();

function groupIdOf(user: ScopedUser): string | null {
	const eg = user.enforcement_group;
	if (!eg) return null;
	if (typeof eg === 'string') return eg;
	return String(eg._id);
}

/** `YYYY-MM-DD` start/end days as an inclusive range, the same way the report pages read them. */
function dayRange(from: string, to: string) {
	return { $gte: new Date(`${from}T00:00:00`), $lte: new Date(`${to}T23:59:59.999`) };
}

const PENDING_TTL_MS = 15 * 60 * 1000;
const reference = customAlphabet('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 8);

// ---- generate form options ---------------------------------------------------------------

/** What the generate form's pickers offer, narrowed to what this person may generate for. */
export async function getGenerateOptions(user: Actor) {
	const scope = requireAccess(user, 'incentives', 'create');
	const own_group = toObjectId(groupIdOf(user));

	const group_filter =
		scope === 'office' ? { _id: own_group } : ({ archived: { $ne: true } } as const);
	const user_filter =
		scope === 'office'
			? { enforcement_group: own_group }
			: scope === 'own'
				? { _id: toObjectId(user._id) }
				: {};

	const [groups, users, user_types, categories, provisions] = await Promise.all([
		EnforcementGroupsModel.find(group_filter, { name: 1, incentive: 1 }).sort({ name: 1 }).lean(),
		UsersModel.find(user_filter, { firstname: 1, lastname: 1, archived: 1 })
			.sort({ lastname: 1, firstname: 1 })
			.lean(),
		UserTypesModel.find({ archived: { $ne: true } }, { user_type: 1 })
			.sort({ user_type: 1 })
			.lean(),
		ViolationCategoryModel.find({ archived: { $ne: true } }, { name: 1 })
			.sort({ name: 1 })
			.lean(),
		CodeProvisionsModel.find({ archived: { $ne: true } }, { code: 1, description: 1 })
			.sort({ code: 1 })
			.lean()
	]);

	return {
		scope,
		groups: plain<
			{
				_id: string;
				name: string;
				incentive?: {
					enabled: boolean;
					rate_type: Incentive.RateType;
					amount: number;
					basis: Incentive.Basis;
				} | null;
			}[]
		>(groups),
		users: plain<{ _id: string; firstname: string; lastname: string; archived?: boolean }[]>(users),
		user_types: plain<{ _id: string; user_type: string }[]>(user_types),
		categories: plain<{ _id: string; name: string }[]>(categories),
		provisions: plain<{ _id: string; code: string; description: string }[]>(provisions)
	};
}

// ---- building the ticket lines -----------------------------------------------------------

type Candidate = {
	_id: Id;
	tracking_code: string;
	ticket_series?: number;
	issuer: Id;
	enforcement_group: Id;
	apprehension_date: Date;
	violations?: { penalty?: { pecuniary?: number } }[];
};

const CANDIDATE_FIELDS = {
	tracking_code: 1,
	ticket_series: 1,
	issuer: 1,
	enforcement_group: 1,
	apprehension_date: 1,
	'violations.penalty.pecuniary': 1
};

export type BuildFailure = {
	ok: false;
	message: string;
	/** superforms paths, e.g. `settings[2].override_reason` */
	field_errors?: { path: string; message: string }[];
};

type BuildSuccess = {
	ok: true;
	preview: Incentive.Preview;
	period: { from: Date; to: Date };
};

const fail = (message: string, field_errors?: BuildFailure['field_errors']): BuildFailure => ({
	ok: false,
	message,
	field_errors
});

/**
 * Finds every ticket that qualifies for the submitted filters and per-group rates, and prices it.
 * Runs entirely from the submitted parameters — the browser's own totals are never trusted.
 */
export async function buildIncentives(
	user: Actor,
	input: Incentive.PreviewInput,
	/** previews skip this so they can refresh while the person works; generating never does */
	{ require_reasons = true }: { require_reasons?: boolean } = {}
): Promise<BuildSuccess | BuildFailure> {
	const scope = requireAccess(user, 'incentives', 'create');
	const own_group = groupIdOf(user);

	// 1. the groups being paid out: the ones switched on, which must be within this person's scope
	const included = input.settings.map((s, index) => ({ ...s, index })).filter((s) => s.include);

	if (!included.length) return fail('Include at least one enforcement group.');
	if (new Set(included.map((s) => s.group)).size !== included.length) {
		return fail('An enforcement group is listed more than once.');
	}
	if (scope === 'office' && included.some((s) => s.group !== own_group)) {
		return fail('You can only generate incentives for your own enforcement group.');
	}
	if (
		input.enforcement_group.length &&
		included.some((s) => !input.enforcement_group.includes(s.group))
	) {
		return fail('A group in the rates table is not one of the selected enforcement groups.');
	}

	const group_docs = await EnforcementGroupsModel.find(
		{ _id: { $in: objectIds(included.map((s) => s.group)) } },
		{ name: 1, incentive: 1 }
	).lean<
		{
			_id: Id;
			name: string;
			incentive?: {
				enabled: boolean;
				rate_type: Incentive.RateType;
				amount: number;
				basis: Incentive.Basis;
			} | null;
		}[]
	>();
	const group_by_id = new Map(group_docs.map((g) => [String(g._id), g]));
	if (group_by_id.size !== included.length) {
		return fail('One of the selected enforcement groups no longer exists.');
	}

	// 2. compare each applied rate with the group's saved settings; any difference needs a reason
	const field_errors: NonNullable<BuildFailure['field_errors']> = [];
	const group_settings: Incentive.GroupSettingSnapshot[] = included.map((s) => {
		const doc = group_by_id.get(s.group)!;
		const saved = doc.incentive;
		const defaults: Incentive.Rate | null = saved
			? { rate_type: saved.rate_type, amount: saved.amount, basis: saved.basis }
			: null;
		const applied: Incentive.Rate = { rate_type: s.rate_type, amount: s.amount, basis: s.basis };
		const overridden = !saved?.enabled || !sameRate(defaults, applied);

		if (require_reasons && overridden && !s.override_reason) {
			field_errors.push({
				path: `settings[${s.index}].override_reason`,
				message: saved?.enabled
					? 'Say why this differs from the group’s saved rate.'
					: 'This group has no active saved rate — say why it is being paid.'
			});
		}

		return {
			group: s.group,
			name: doc.name,
			defaults,
			defaults_enabled: !!saved?.enabled,
			applied,
			overridden,
			override_reason: overridden ? s.override_reason : ''
		};
	});

	if (field_errors.length) {
		return fail(
			'Give a reason for each group whose rate differs from its saved settings.',
			field_errors
		);
	}

	// 3. ticket filters shared by both bases
	const period = dayRange(input.date_from, input.date_to);
	const match: Record<string, unknown> = { status: { $ne: issuance_status.CANCELLED } };

	let issuer_ids: string[] | null = input.issuer.length ? [...input.issuer] : null;
	if (input.user_type.length) {
		const of_type = (
			await UsersModel.find({ user_type: { $in: objectIds(input.user_type) } }).distinct('_id')
		).map(String);
		issuer_ids = issuer_ids ? issuer_ids.filter((id) => of_type.includes(id)) : of_type;
	}
	if (scope === 'own') {
		issuer_ids = (issuer_ids ?? [String(user._id)]).filter((id) => id === String(user._id));
	}
	if (issuer_ids) match.issuer = { $in: objectIds(issuer_ids) };

	if (input.exclude_legacy) match.legacy_ticket_issue_id = { $not: { $gt: 0 } };

	if (input.violation_category.length) {
		// violations snapshot the category *name*, so match on the names of the picked ids
		const names = await ViolationCategoryModel.find(
			{ _id: { $in: objectIds(input.violation_category) } },
			{ name: 1 }
		).distinct('name');
		match['violations.violation_category.name'] = { $in: names };
	}
	if (input.code_provision.length) {
		match['violations.code_provision'] = { $in: objectIds(input.code_provision) };
	}
	if (input.barangay) {
		match.apprehension_barangay = { $regex: escapeRegex(input.barangay), $options: 'i' };
	}

	const groups_on = (basis: Incentive.Basis) =>
		objectIds(group_settings.filter((g) => g.applied.basis === basis).map((g) => g.group));
	const issued_groups = groups_on('issued');
	const paid_groups = groups_on('paid');

	const skipped = { already_in_report: 0, reissued: 0, not_fully_paid: 0, no_group: 0 };

	// 'issued': apprehended within the period; base is the fine total
	const issued = issued_groups.length
		? await IssuanceModel.find(
				{ ...match, enforcement_group: { $in: issued_groups }, apprehension_date: period },
				CANDIDATE_FIELDS
			).lean<Candidate[]>()
		: [];
	// tickets that would match but have no group recorded can't be paid to any group — count them
	// so an empty or short result explains itself instead of silently missing tickets
	if (issued_groups.length) {
		skipped.no_group += await IssuanceModel.countDocuments({
			...match,
			enforcement_group: null,
			apprehension_date: period
		});
	}

	// 'paid': the bill is fully paid and the payment that cleared it falls within the period;
	// base is the amount paid. Starting from payments made in the period keeps this to a few
	// batched queries instead of a lookup per ticket.
	const paid: (Candidate & { amount_paid: number; settled_on: Date })[] = [];
	if (paid_groups.length) {
		const paid_in_period = await PaymentModel.distinct('issuance', { payment_date: period });
		const candidates = paid_in_period.length
			? await IssuanceModel.find(
					{ ...match, enforcement_group: { $in: paid_groups }, _id: { $in: paid_in_period } },
					CANDIDATE_FIELDS
				).lean<Candidate[]>()
			: [];
		if (paid_in_period.length) {
			skipped.no_group += await IssuanceModel.countDocuments({
				...match,
				enforcement_group: null,
				_id: { $in: paid_in_period }
			});
		}
		const ids = candidates.map((c) => c._id);

		const [billings, last_payments] = await Promise.all([
			BillingModel.find(
				{ issuance: { $in: ids }, payment_status: 'PAID', cancelled: { $ne: true } },
				{ issuance: 1, amount_paid: 1 }
			).lean<{ issuance: Id; amount_paid: number }[]>(),
			PaymentModel.aggregate<{ _id: Id; last: Date }>([
				{ $match: { issuance: { $in: ids } } },
				{ $group: { _id: '$issuance', last: { $max: '$payment_date' } } }
			])
		]);
		const amount_paid = new Map(billings.map((b) => [String(b.issuance), b.amount_paid]));
		const last_paid = new Map(last_payments.map((p) => [String(p._id), p.last]));

		for (const c of candidates) {
			const amount = amount_paid.get(String(c._id));
			if (amount === undefined) {
				skipped.not_fully_paid++;
				continue;
			}
			const settled_on = last_paid.get(String(c._id));
			// fully paid, but cleared by a payment after the period — it belongs to a later report
			if (!settled_on || settled_on < period.$gte || settled_on > period.$lte) continue;
			paid.push({ ...c, amount_paid: amount, settled_on });
		}
	}

	// 4. leave out tickets that were reissued (only the latest in a chain counts) and tickets
	// already counted in a report that hasn't been voided
	const all_ids = [...issued, ...paid].map((c) => c._id);
	const [reissued_ids, claimed_ids] = all_ids.length
		? await Promise.all([
				IssuanceModel.distinct('reissued_from', {
					reissued_from: { $in: all_ids },
					status: { $ne: issuance_status.CANCELLED }
				}),
				IncentiveReportItemsModel.distinct('issuance', {
					issuance: { $in: all_ids },
					status: 'active'
				})
			])
		: [[], []];
	const reissued = new Set(reissued_ids.map(String));
	const claimed = new Set(claimed_ids.map(String));
	const rate_of = new Map(group_settings.map((g) => [g.group, g.applied]));

	const lines: Incentive.Line[] = [];
	const addLine = (c: Candidate, base: number, event_date: Date) => {
		const id = String(c._id);
		if (reissued.has(id)) return void skipped.reissued++;
		if (claimed.has(id)) return void skipped.already_in_report++;

		const group = String(c.enforcement_group);
		const rate = rate_of.get(group)!;
		lines.push({
			issuance: id,
			tracking_code: c.tracking_code,
			ticket_series: c.ticket_series ?? 0,
			issuer: String(c.issuer),
			group,
			basis: rate.basis,
			event_date: new Date(event_date).toISOString(),
			base_amount: round2(base),
			incentive_amount: incentiveFor(base, rate)
		});
	};

	for (const c of issued) {
		const fine = (c.violations ?? []).reduce((sum, v) => sum + (v.penalty?.pecuniary ?? 0), 0);
		addLine(c, fine, c.apprehension_date);
	}
	for (const c of paid) addLine(c, c.amount_paid, c.settled_on);

	// 5. names for the officers in the result
	const people_docs = await UsersModel.find(
		{ _id: { $in: objectIds([...new Set(lines.map((l) => l.issuer))]) } },
		{ firstname: 1, lastname: 1, user_type: 1 }
	)
		.populate('user_type', 'user_type')
		.lean<{ _id: Id; firstname: string; lastname: string; user_type?: { user_type?: string } }[]>();

	const people = Object.fromEntries(
		people_docs.map((p) => [
			String(p._id),
			{ name: fullName(p), user_type: p.user_type?.user_type ?? '' }
		])
	);
	const groups = Object.fromEntries(
		group_settings.map((g) => [g.group, { name: g.name, basis: g.applied.basis }])
	);

	lines.sort(
		(a, b) =>
			groups[a.group].name.localeCompare(groups[b.group].name) ||
			(people[a.issuer]?.name ?? '').localeCompare(people[b.issuer]?.name ?? '') ||
			a.event_date.localeCompare(b.event_date)
	);

	return {
		ok: true,
		preview: { lines, people, groups, group_settings, skipped },
		period: { from: period.$gte, to: period.$lte }
	};
}

// ---- generating --------------------------------------------------------------------------

/** Removes reports left 'pending' by a generate that died between writing the header and finishing. */
async function cleanupStalePending() {
	const stale = await IncentiveReportsModel.find({
		status: 'pending',
		created_at: { $lt: new Date(Date.now() - PENDING_TTL_MS) }
	}).distinct('_id');
	if (!stale.length) return;
	await IncentiveReportItemsModel.deleteMany({ report: { $in: stale } });
	await IncentiveReportsModel.deleteMany({ _id: { $in: stale }, status: 'pending' });
}

async function namedRefs(
	model: mongoose.Model<unknown>,
	ids: string[],
	label: (doc: Record<string, unknown>) => string,
	fields: Record<string, 1>
) {
	if (!ids.length) return [];
	const docs = (await model.find({ _id: { $in: objectIds(ids) } }, fields).lean()) as Record<
		string,
		unknown
	>[];
	return docs.map((d) => ({ _id: d._id, name: label(d) }));
}

const isDuplicateKey = (err: unknown) =>
	(err as { code?: number })?.code === 11000 ||
	!!(err as { writeErrors?: { code?: number }[] })?.writeErrors?.some((e) => e.code === 11000);

/**
 * Saves a report. Without Mongo transactions (standalone server, see CLAUDE.md #5) this writes
 * in steps: header as 'pending' → ticket lines → header 'generated'. If writing the lines fails
 * — including when another report claimed one of the tickets a moment earlier — this attempt's
 * lines and header are removed again.
 */
export async function generateIncentiveReport(
	user: Actor,
	input: Incentive.Generate
): Promise<{ ok: true; _id: string; reference_no: string } | BuildFailure> {
	await cleanupStalePending();

	const built = await buildIncentives(user, input);
	if (!built.ok) return built;
	const { preview, period } = built;

	const reasons = new Map(input.excluded.map((e) => [e.issuance, e.reason]));
	const lines = preview.lines.filter((l) => !reasons.has(l.issuance));
	if (!lines.length) {
		return fail('There are no tickets to include. Change the filters or include more tickets.');
	}

	const exclusions = preview.lines
		.filter((l) => reasons.has(l.issuance))
		.map((l) => ({
			issuance: l.issuance,
			tracking_code: l.tracking_code,
			issuer: l.issuer,
			group: l.group,
			reason: reasons.get(l.issuance)!
		}));

	const { by_group, by_recipient, totals } = summarize(lines, preview.people, preview.groups);

	const [enforcement_groups, issuers, user_types, violation_categories, code_provisions] =
		await Promise.all([
			namedRefs(EnforcementGroupsModel, input.enforcement_group, (d) => String(d.name), {
				name: 1
			}),
			namedRefs(
				UsersModel,
				input.issuer,
				(d) => fullName(d as { firstname?: string; lastname?: string }),
				{ firstname: 1, lastname: 1 }
			),
			namedRefs(UserTypesModel, input.user_type, (d) => String(d.user_type), { user_type: 1 }),
			namedRefs(ViolationCategoryModel, input.violation_category, (d) => String(d.name), {
				name: 1
			}),
			namedRefs(CodeProvisionsModel, input.code_provision, (d) => String(d.code), { code: 1 })
		]);

	const reference_no = `INC${new Date().getFullYear()}-${reference()}`;

	const header = await IncentiveReportsModel.create({
		reference_no,
		status: 'pending',
		period,
		filters: {
			enforcement_groups,
			issuers,
			user_types,
			violation_categories,
			code_provisions,
			barangay: input.barangay,
			exclude_legacy: input.exclude_legacy
		},
		groups: by_group.map((g) => g.group),
		group_settings: preview.group_settings,
		by_group,
		by_recipient,
		totals,
		exclusions,
		remarks: input.remarks,
		generated_by: user._id,
		generated_by_name: fullName(user)
	});

	try {
		await IncentiveReportItemsModel.insertMany(
			lines.map((l) => ({ ...l, report: header._id, status: 'active' })),
			{ ordered: true }
		);
	} catch (err) {
		await IncentiveReportItemsModel.deleteMany({ report: header._id });
		await IncentiveReportsModel.deleteOne({ _id: header._id });
		if (isDuplicateKey(err)) {
			return fail(
				'Some of these tickets were just included in another report. Preview again to see the current list.'
			);
		}
		throw err;
	}

	await IncentiveReportsModel.updateOne({ _id: header._id }, { $set: { status: 'generated' } });

	await createLog({
		level: 'INFO',
		type: 'CREATE',
		message: `generated incentive report ${reference_no}`,
		source: 'incentives form action - generate',
		affected_collection: {
			collection_name: 'incentive_reports',
			document_id: [String(header._id)]
		},
		user: logActor(user),
		metadata: {
			reference_no,
			period: { from: input.date_from, to: input.date_to },
			filters: {
				enforcement_group: input.enforcement_group,
				issuer: input.issuer,
				user_type: input.user_type,
				violation_category: input.violation_category,
				code_provision: input.code_provision,
				barangay: input.barangay,
				exclude_legacy: input.exclude_legacy
			},
			group_settings: preview.group_settings,
			excluded_count: exclusions.length,
			totals
		}
	});

	return { ok: true, _id: String(header._id), reference_no };
}

// ---- reading -----------------------------------------------------------------------------

type ReportDoc = Incentive.Report;

/**
 * The part of a report a person may see: everything at 'all' scope, only their own group's rows
 * at 'office', only their own rows at 'own'. Totals are recomputed for a partial view.
 */
function visiblePart(scope: permission_scope, user: ScopedUser, report: ReportDoc) {
	if (scope === 'all') {
		return {
			partial: false,
			by_group: report.by_group,
			by_recipient: report.by_recipient,
			totals: report.totals,
			exclusions: report.exclusions
		};
	}

	const own_group = groupIdOf(user);
	const self = String(user._id);
	const keep = (row: { group: string | null; user?: string | null }) =>
		scope === 'office' ? row.group === own_group : row.user === self;

	const by_recipient = report.by_recipient.filter((r) => keep({ group: r.group, user: r.user }));
	const by_group = report.by_group
		.filter((g) => by_recipient.some((r) => r.group === g.group))
		.map((g) => {
			const rows = by_recipient.filter((r) => r.group === g.group);
			const t = totalsOf(rows);
			return {
				...g,
				ticket_count: t.ticket_count,
				base_amount: t.base_amount,
				incentive_amount: t.incentive_amount
			};
		});

	return {
		partial: true,
		by_group,
		by_recipient,
		totals: totalsOf(by_recipient),
		exclusions: report.exclusions.filter((e) => keep({ group: e.group, user: e.issuer }))
	};
}

export async function listIncentiveReports(user: Actor, params: URLSearchParams) {
	const scope = requireAccess(user, 'incentives');
	const { skip, limit, search } = parseSearchParams(params);

	const match: Record<string, unknown> = { status: { $in: ['generated', 'voided'] } };

	const statuses = multiParam(params, 'status').filter((s) => s === 'generated' || s === 'voided');
	if (statuses.length) match.status = { $in: statuses };

	if (search) match.reference_no = { $regex: escapeRegex(search), $options: 'i' };

	// reports whose period overlaps the picked range
	const from = params.get('date_from');
	const to = params.get('date_to');
	if (from) match['period.to'] = { $gte: new Date(`${from}T00:00:00`) };
	if (to) match['period.from'] = { $lte: new Date(`${to}T23:59:59.999`) };

	const picked_groups = objectIds(multiParam(params, 'enforcement_group'));
	if (picked_groups.length) match.groups = { $in: picked_groups };

	if (scope === 'office') {
		match.groups = toObjectId(groupIdOf(user));
	} else if (scope === 'own') {
		match._id = {
			$in: await IncentiveReportItemsModel.distinct('report', { issuer: toObjectId(user._id) })
		};
	}

	const [total, docs] = await Promise.all([
		IncentiveReportsModel.countDocuments(match),
		IncentiveReportsModel.find(match, {
			reference_no: 1,
			status: 1,
			period: 1,
			group_settings: 1,
			by_group: 1,
			by_recipient: 1,
			totals: 1,
			exclusions: 1,
			generated_by_name: 1,
			created_at: 1
		})
			.sort({ created_at: -1 })
			.skip(skip)
			.limit(limit)
			.lean()
	]);

	const rows = plain<ReportDoc[]>(docs).map((r) => {
		const visible = visiblePart(scope, user, r);
		return {
			_id: r._id,
			reference_no: r.reference_no,
			status: r.status,
			period: r.period,
			group_names: visible.by_group.map((g) => g.name),
			generated_by_name: r.generated_by_name,
			created_at: r.created_at,
			totals: visible.totals
		};
	});

	return { scope, total, rows };
}

export async function getIncentiveReport(user: Actor, id: string) {
	const scope = requireAccess(user, 'incentives');
	const _id = toObjectId(id);
	if (!_id) error(404, 'Incentive report not found.');

	const doc = await IncentiveReportsModel.findOne({ _id, status: { $ne: 'pending' } }).lean();
	if (!doc) error(404, 'Incentive report not found.');
	const report = plain<ReportDoc>(doc);

	const item_filter: Record<string, unknown> = { report: _id };
	if (scope === 'office') {
		const own_group = groupIdOf(user);
		if (!own_group || !report.groups.includes(own_group)) {
			error(403, 'You do not have permission to view this report.');
		}
		item_filter.group = toObjectId(own_group);
	} else if (scope === 'own') {
		item_filter.issuer = toObjectId(user._id);
	}

	const items = plain<(Incentive.Line & { _id: string; status: string })[]>(
		await IncentiveReportItemsModel.find(item_filter).sort({ event_date: 1 }).lean()
	);
	if (scope === 'own' && !items.length) {
		error(403, 'You do not have permission to view this report.');
	}

	// tickets that changed after the report was generated — the report keeps what was paid,
	// but the reader should know the underlying ticket no longer qualifies
	const changed: { issuance: string; tracking_code: string; reason: string }[] = [];
	if (report.status === 'generated' && items.length) {
		const ids = objectIds(items.map((i) => i.issuance));
		const paid_ids = objectIds(items.filter((i) => i.basis === 'paid').map((i) => i.issuance));
		const [cancelled, unpaid] = await Promise.all([
			IssuanceModel.distinct('_id', { _id: { $in: ids }, status: issuance_status.CANCELLED }),
			paid_ids.length
				? BillingModel.distinct('issuance', {
						issuance: { $in: paid_ids },
						$or: [{ payment_status: { $ne: 'PAID' } }, { cancelled: true }]
					})
				: Promise.resolve([])
		]);
		const cancelled_set = new Set(cancelled.map(String));
		const unpaid_set = new Set(unpaid.map(String));
		for (const i of items) {
			if (cancelled_set.has(i.issuance)) {
				changed.push({ ...i, reason: 'Cancelled after this report was generated' });
			} else if (unpaid_set.has(i.issuance)) {
				changed.push({ ...i, reason: 'No longer fully paid (a payment was edited)' });
			}
		}
	}

	const visible = visiblePart(scope, user, report);
	return {
		scope,
		partial: visible.partial,
		report: { ...report, ...visible },
		items,
		changed: changed.map(({ issuance, tracking_code, reason }) => ({
			issuance,
			tracking_code,
			reason
		}))
	};
}

// ---- voiding -----------------------------------------------------------------------------

/**
 * Voids a report: it stays on record (with who voided it and why) but its tickets are released
 * so they can be counted in a new report. Reports are never edited or deleted.
 */
export async function voidIncentiveReport(user: Actor, input: Incentive.Void) {
	const scope = requireAccess(user, 'incentives', 'archive');
	const _id = toObjectId(input._id);
	if (!_id) error(404, 'Incentive report not found.');

	const report = await IncentiveReportsModel.findOne({ _id, status: { $ne: 'pending' } }).lean<{
		_id: Id;
		reference_no: string;
		status: Incentive.ReportStatus;
		groups: Id[];
		generated_by: Id;
	}>();
	if (!report) error(404, 'Incentive report not found.');

	if (scope === 'own' && String(report.generated_by) !== String(user._id)) {
		error(403, 'You can only void reports you generated.');
	}
	if (scope === 'office') {
		const own_group = groupIdOf(user);
		if (!own_group || report.groups.some((g) => String(g) !== own_group)) {
			error(403, 'You can only void reports that cover only your own enforcement group.');
		}
	}

	const already = report.status === 'voided';
	if (!already) {
		await IncentiveReportsModel.updateOne(
			{ _id, status: 'generated' },
			{
				$set: {
					status: 'voided',
					voided_at: new Date(),
					voided_by: user._id,
					voided_by_name: fullName(user),
					void_reason: input.reason
				}
			}
		);
	}
	// header first, then lines: if this second write fails the tickets stay locked (never
	// double-paid), and voiding again finishes the job
	await IncentiveReportItemsModel.updateMany(
		{ report: _id, status: 'active' },
		{ $set: { status: 'voided' } }
	);

	if (!already) {
		await createLog({
			level: 'NOTICE',
			type: 'ARCHIVE',
			message: `voided incentive report ${report.reference_no}`,
			source: 'incentives form action - void',
			affected_collection: { collection_name: 'incentive_reports', document_id: [String(_id)] },
			user: logActor(user),
			metadata: { reference_no: report.reference_no, reason: input.reason }
		});
	}

	return { already };
}
