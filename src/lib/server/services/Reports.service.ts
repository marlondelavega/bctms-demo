import type { PipelineStage } from 'mongoose';
import IssuanceModel from '$lib/server/models/Issuance.model';
import PaymentModel from '$lib/server/models/Payments.model';
import UsersModel from '$lib/server/models/Users.model';
import EnforcementGroupsModel from '$lib/server/models/EnforcementGroups.model';
import ViolationCategoryModel from '$lib/server/models/ViolationCategories.model';
import CodeProvisionsModel from '$lib/server/models/CodeProvision.model';
import { toObjectId } from '$lib/utilities/helper';
import {
	requireAccess,
	scopeFilter,
	type ScopedUser
} from '$lib/server/utilities/permissions.server';

const MAX_ROWS = 500;

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function dateRange(params: URLSearchParams, fromKey: string, toKey: string) {
	const from = params.get(fromKey);
	const to = params.get(toKey);
	const range: Record<string, Date> = {};
	if (from) range.$gte = new Date(`${from}T00:00:00`);
	if (to) range.$lte = new Date(`${to}T23:59:59.999`);
	return Object.keys(range).length ? range : null;
}

/** Every non-empty value of a repeatable filter (`?status=1&status=3`). */
export function multiParam(params: URLSearchParams, key: string): string[] {
	return [
		...new Set(
			params
				.getAll(key)
				.map((v) => v.trim())
				.filter(Boolean)
		)
	];
}

const objectIds = (values: string[]) =>
	values.map((v) => toObjectId(v)).filter((v): v is NonNullable<typeof v> => !!v);

/** Filters the report pages accept more than one value for. */
export const ISSUANCE_MULTI_FILTERS = [
	'status',
	'issuer',
	'enforcement_group',
	'violation_category',
	'code_provision'
] as const;
export const PAYMENT_MULTI_FILTERS = [
	'payment_method',
	'created_by',
	'enforcement_group',
	'status',
	'violation_category'
] as const;

/** What the filter form should show as currently applied: repeatable keys are always arrays. */
export function appliedFilters<K extends string>(params: URLSearchParams, multi: readonly K[]) {
	return {
		date_from: params.get('date_from') ?? '',
		date_to: params.get('date_to') ?? '',
		barangay: params.get('barangay')?.trim() ?? '',
		...Object.fromEntries(multi.map((k) => [k, multiParam(params, k)]))
	} as { date_from: string; date_to: string; barangay: string } & Record<K, string[]>;
}

const NO_MATCH_ID = toObjectId('000000000000000000000000');

/** Names of the documents behind a list of picked ids (unknown ids are dropped). */
async function namesOf(
	model: { find: (filter: object, projection: object) => { lean: () => Promise<unknown> } },
	ids: string[]
): Promise<string[]> {
	const found = (await model.find({ _id: { $in: objectIds(ids) } }, { name: 1 }).lean()) as {
		name: string;
	}[];
	return found.map((d) => d.name);
}

/** Lookup lists a report's filter dropdowns are populated from. */
export async function getReportFilterOptions() {
	const [enforcement_groups, violation_categories, code_provisions, issuers] = await Promise.all([
		EnforcementGroupsModel.find({ archived: { $ne: true } }, { name: 1 })
			.sort({ name: 1 })
			.lean(),
		ViolationCategoryModel.find({ archived: { $ne: true } }, { name: 1 })
			.sort({ name: 1 })
			.lean(),
		CodeProvisionsModel.find({ archived: { $ne: true } }, { code: 1, description: 1 })
			.sort({ code: 1 })
			.lean(),
		UsersModel.find({ archived: { $ne: true } }, { firstname: 1, lastname: 1 })
			.sort({ lastname: 1, firstname: 1 })
			.lean()
	]);

	return {
		enforcement_groups: JSON.parse(JSON.stringify(enforcement_groups)) as {
			_id: string;
			name: string;
		}[],
		violation_categories: JSON.parse(JSON.stringify(violation_categories)) as {
			_id: string;
			name: string;
		}[],
		code_provisions: JSON.parse(JSON.stringify(code_provisions)) as {
			_id: string;
			code: string;
			description: string;
		}[],
		issuers: JSON.parse(JSON.stringify(issuers)) as {
			_id: string;
			firstname: string;
			lastname: string;
		}[]
	};
}

export async function getIssuanceReport(user: ScopedUser, params: URLSearchParams) {
	const scope = requireAccess(user, 'reports');
	const match: Record<string, unknown> = {
		...(await scopeFilter(user, scope, { ownField: 'issuer' }))
	};

	const apprehension_date = dateRange(params, 'date_from', 'date_to');
	if (apprehension_date) match.apprehension_date = apprehension_date;

	const statuses = multiParam(params, 'status').map(Number).filter(Number.isFinite);
	if (statuses.length) match.status = { $in: statuses };

	const issuers = objectIds(multiParam(params, 'issuer'));
	if (issuers.length) match.issuer = { $in: issuers };

	const barangay = params.get('barangay')?.trim();
	if (barangay) match.apprehension_barangay = { $regex: escapeRegex(barangay), $options: 'i' };

	const code_provisions = objectIds(multiParam(params, 'code_provision'));
	if (code_provisions.length) match['violations.code_provision'] = { $in: code_provisions };

	// violations snapshot the group/category *name*, so resolve the picked ids to names
	const group_ids = multiParam(params, 'enforcement_group');
	if (group_ids.length) {
		const names = await namesOf(EnforcementGroupsModel, group_ids);
		if (names.length) match['violations.enforcement_group.name'] = { $in: names };
		else match._id = NO_MATCH_ID;
	}

	const category_ids = multiParam(params, 'violation_category');
	if (category_ids.length) {
		const names = await namesOf(ViolationCategoryModel, category_ids);
		if (names.length) match['violations.violation_category.name'] = { $in: names };
		else match._id = NO_MATCH_ID;
	}

	const facets: Record<string, PipelineStage.FacetPipelineStage[]> = {
		total: [{ $count: 'count' }],
		summary: [
			{
				$group: {
					_id: null,
					violation_count: { $sum: { $size: '$violations' } },
					total_amount: { $sum: { $sum: '$violations.penalty.pecuniary' } }
				}
			}
		],
		by_status: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
		by_barangay: [
			{ $group: { _id: '$apprehension_barangay', count: { $sum: 1 } } },
			{ $sort: { count: -1 } },
			{ $limit: 10 }
		],
		by_category: [
			{ $unwind: '$violations' },
			{
				$group: {
					_id: '$violations.violation_category.name',
					count: { $sum: 1 },
					amount: { $sum: '$violations.penalty.pecuniary' }
				}
			},
			{ $sort: { count: -1 } }
		],
		by_enforcement_group: [
			{ $unwind: '$violations' },
			{ $group: { _id: '$violations.enforcement_group.name', count: { $sum: 1 } } },
			{ $sort: { count: -1 } }
		],
		by_issuer: [
			{ $group: { _id: '$issuer', count: { $sum: 1 } } },
			{ $sort: { count: -1 } },
			{ $limit: 10 },
			{ $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
			{ $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
			{
				$project: {
					count: 1,
					name: {
						$trim: {
							input: {
								$concat: [
									{ $ifNull: ['$user.firstname', ''] },
									' ',
									{ $ifNull: ['$user.lastname', ''] }
								]
							}
						}
					}
				}
			}
		],
		rows: [
			{ $sort: { apprehension_date: -1, _id: -1 } },
			{ $limit: MAX_ROWS },
			{
				$lookup: {
					from: 'violators',
					localField: 'recipient',
					foreignField: '_id',
					as: 'recipient'
				}
			},
			{ $unwind: { path: '$recipient', preserveNullAndEmptyArrays: true } },
			{ $lookup: { from: 'users', localField: 'issuer', foreignField: '_id', as: 'issuer' } },
			{ $unwind: { path: '$issuer', preserveNullAndEmptyArrays: true } },
			{
				$project: {
					tracking_code: 1,
					status: 1,
					apprehension_date: 1,
					apprehension_barangay: 1,
					violations_count: { $size: '$violations' },
					amount: { $sum: '$violations.penalty.pecuniary' },
					codes: '$violations.code',
					recipient_name: {
						$trim: {
							input: {
								$concat: [
									{ $ifNull: ['$recipient.firstname', ''] },
									' ',
									{ $ifNull: ['$recipient.lastname', ''] }
								]
							}
						}
					},
					issuer_name: {
						$trim: {
							input: {
								$concat: [
									{ $ifNull: ['$issuer.firstname', ''] },
									' ',
									{ $ifNull: ['$issuer.lastname', ''] }
								]
							}
						}
					}
				}
			}
		]
	};

	const [raw] = await IssuanceModel.aggregate([{ $match: match }, { $facet: facets }]);
	// ObjectId/Date instances from $group._id and friends aren't plain-serializable — strip them
	const result = JSON.parse(JSON.stringify(raw));

	return {
		scope,
		total: result.total[0]?.count ?? 0,
		truncated: (result.total[0]?.count ?? 0) > MAX_ROWS,
		max_rows: MAX_ROWS,
		summary: {
			ticket_count: result.total[0]?.count ?? 0,
			violation_count: result.summary[0]?.violation_count ?? 0,
			total_amount: result.summary[0]?.total_amount ?? 0
		},
		by_status: result.by_status as { _id: number; count: number }[],
		by_barangay: result.by_barangay as { _id: string; count: number }[],
		by_category: result.by_category as { _id: string; count: number; amount: number }[],
		by_enforcement_group: result.by_enforcement_group as { _id: string; count: number }[],
		by_issuer: result.by_issuer as { _id: string; count: number; name: string }[],
		rows: result.rows as {
			_id: string;
			tracking_code: string;
			status: number;
			apprehension_date: string;
			apprehension_barangay: string;
			violations_count: number;
			amount: number;
			codes: string[];
			recipient_name: string;
			issuer_name: string;
		}[]
	};
}

export async function getPaymentReport(user: ScopedUser, params: URLSearchParams) {
	const scope = requireAccess(user, 'reports');
	const match: Record<string, unknown> = {
		...(await scopeFilter(user, scope, { ownField: 'created_by' }))
	};

	const payment_date = dateRange(params, 'date_from', 'date_to');
	if (payment_date) match.payment_date = payment_date;

	const payment_methods = multiParam(params, 'payment_method');
	if (payment_methods.length) match.payment_method = { $in: payment_methods };

	// "recorded by" and "enforcement group" both constrain created_by: a payment must satisfy
	// both, so intersect them instead of letting the later one overwrite the earlier
	let created_by_ids: string[] | null = null;
	const recorders = objectIds(multiParam(params, 'created_by'));
	if (recorders.length) created_by_ids = recorders.map(String);

	const group_ids = objectIds(multiParam(params, 'enforcement_group'));
	if (group_ids.length) {
		const in_groups = (
			await UsersModel.find({ enforcement_group: { $in: group_ids } }).distinct('_id')
		).map(String);
		created_by_ids = created_by_ids
			? created_by_ids.filter((id) => in_groups.includes(id))
			: in_groups;
	}
	if (created_by_ids) match.created_by = { $in: objectIds(created_by_ids) };

	// issuance-linked filters (barangay, status, violation category, code) — the payment
	// itself carries none of these, so join first and match on the joined subdocument.
	const barangay = params.get('barangay')?.trim();
	const statuses = multiParam(params, 'status').map(Number).filter(Number.isFinite);
	const code_provisions = objectIds(multiParam(params, 'code_provision'));
	const category_ids = multiParam(params, 'violation_category');
	const needsIssuanceJoin = Boolean(
		barangay || statuses.length || code_provisions.length || category_ids.length
	);

	const pipeline: PipelineStage[] = [{ $match: match }];

	if (needsIssuanceJoin) {
		pipeline.push(
			{
				$lookup: { from: 'issuances', localField: 'issuance', foreignField: '_id', as: 'issuance' }
			},
			{ $unwind: '$issuance' }
		);

		const issuanceMatch: Record<string, unknown> = {};
		if (barangay)
			issuanceMatch['issuance.apprehension_barangay'] = {
				$regex: escapeRegex(barangay),
				$options: 'i'
			};
		if (statuses.length) issuanceMatch['issuance.status'] = { $in: statuses };
		if (code_provisions.length)
			issuanceMatch['issuance.violations.code_provision'] = { $in: code_provisions };
		if (category_ids.length) {
			const names = await namesOf(ViolationCategoryModel, category_ids);
			issuanceMatch['issuance.violations.violation_category.name'] = {
				$in: names.length ? names : ['\u0000no-match\u0000']
			};
		}
		pipeline.push({ $match: issuanceMatch });
	}

	const facets: Record<string, PipelineStage.FacetPipelineStage[]> = {
		total: [{ $count: 'count' }],
		summary: [{ $group: { _id: null, total_amount: { $sum: '$amount' } } }],
		by_method: [
			{ $group: { _id: '$payment_method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
			{ $sort: { total: -1 } }
		],
		by_user: [
			{ $group: { _id: '$created_by', total: { $sum: '$amount' }, count: { $sum: 1 } } },
			{ $sort: { total: -1 } },
			{ $limit: 10 },
			{ $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
			{ $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
			{
				$project: {
					total: 1,
					count: 1,
					name: {
						$trim: {
							input: {
								$concat: [
									{ $ifNull: ['$user.firstname', ''] },
									' ',
									{ $ifNull: ['$user.lastname', ''] }
								]
							}
						}
					}
				}
			}
		],
		rows: [
			{ $sort: { payment_date: -1, _id: -1 } },
			{ $limit: MAX_ROWS },
			{
				$lookup: { from: 'users', localField: 'created_by', foreignField: '_id', as: 'created_by' }
			},
			{ $unwind: { path: '$created_by', preserveNullAndEmptyArrays: true } },
			{
				$project: {
					tracking_code: 1,
					amount: 1,
					payment_date: 1,
					payment_method: 1,
					reference_number: 1,
					recorded_by_name: {
						$trim: {
							input: {
								$concat: [
									{ $ifNull: ['$created_by.firstname', ''] },
									' ',
									{ $ifNull: ['$created_by.lastname', ''] }
								]
							}
						}
					}
				}
			}
		]
	};

	pipeline.push({ $facet: facets });

	const [raw] = await PaymentModel.aggregate(pipeline);
	// ObjectId/Date instances from $group._id and friends aren't plain-serializable — strip them
	const result = JSON.parse(JSON.stringify(raw));

	return {
		scope,
		total: result.total[0]?.count ?? 0,
		truncated: (result.total[0]?.count ?? 0) > MAX_ROWS,
		max_rows: MAX_ROWS,
		summary: {
			payment_count: result.total[0]?.count ?? 0,
			total_amount: result.summary[0]?.total_amount ?? 0
		},
		by_method: result.by_method as { _id: string; total: number; count: number }[],
		by_user: result.by_user as { _id: string; total: number; count: number; name: string }[],
		rows: result.rows as {
			_id: string;
			tracking_code: string;
			amount: number;
			payment_date: string;
			payment_method: string;
			reference_number: string;
			recorded_by_name: string;
		}[]
	};
}
