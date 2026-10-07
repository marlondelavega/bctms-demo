import IssuanceModel from '$lib/server/models/Issuance.model';
import BillingModel from '$lib/server/models/Billing.model';
import PaymentModel from '$lib/server/models/Payments.model';
import { issuance_status_data } from '$lib/data/static_data';
import { permissions } from '$lib/utilities/helper';
import {
	billingScopeFilter,
	scopeFilter,
	type ScopedUser
} from '$lib/server/utilities/permissions.server';
import type { permission_resource, permission_scope } from '$lib/server/models/UserTypes.model';
import type { PipelineStage } from 'mongoose';

const TZ = 'Asia/Manila';
// Manila has no DST, so a fixed offset is safe for computing day/month boundaries
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
const TREND_DAYS = 30;

export type TrendPoint = { date: string; value: number };

function manilaDayStart(daysAgo = 0) {
	const local = new Date(Date.now() + TZ_OFFSET_MS);
	return new Date(
		Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysAgo) -
			TZ_OFFSET_MS
	);
}

function manilaMonthStart() {
	const local = new Date(Date.now() + TZ_OFFSET_MS);
	return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - TZ_OFFSET_MS);
}

function dayKey(date: Date) {
	return new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function fillDays(rows: { _id: string; value: number }[]): TrendPoint[] {
	const byDay = new Map(rows.map((r) => [r._id, r.value]));
	return Array.from({ length: TREND_DAYS }, (_, i) => {
		const date = dayKey(manilaDayStart(TREND_DAYS - 1 - i));
		return { date, value: byDay.get(date) ?? 0 };
	});
}

// upper bound keeps mistyped future dates (e.g. year 72025) out of the windows
function since(date: Date) {
	return { $gte: date, $lt: manilaDayStart(-1) };
}

function dayGroup(field: string) {
	return { $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: TZ } };
}

function scopeOf(user: ScopedUser, resource: permission_resource): permission_scope {
	return (permissions.get(resource, user.user_type?.permissions).access ??
		'none') as permission_scope;
}

class DashboardServiceClass {
	async get_dashboard(user: ScopedUser) {
		const scopes = {
			issuance: scopeOf(user, 'issuance'),
			billing: scopeOf(user, 'billing'),
			payments: scopeOf(user, 'payments')
		};

		const [issuances, billing, payments] = await Promise.all([
			scopes.issuance !== 'none' ? this.issuance_section(user, scopes.issuance) : null,
			scopes.billing !== 'none' ? this.billing_section(user, scopes.billing) : null,
			scopes.payments !== 'none' ? this.payment_section(user, scopes.payments) : null
		]);

		return { scopes, issuances, billing, payments };
	}

	private async issuance_section(user: ScopedUser, scope: permission_scope) {
		const match = await scopeFilter(user, scope, { ownField: 'issuer' });
		const month_start = manilaMonthStart();

		const facets: Record<string, PipelineStage.FacetPipelineStage[]> = {
			by_status: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
			this_month: [{ $match: { apprehension_date: since(month_start) } }, { $count: 'count' }],
			today: [{ $match: { apprehension_date: since(manilaDayStart()) } }, { $count: 'count' }],
			trend: [
				{ $match: { apprehension_date: since(manilaDayStart(TREND_DAYS - 1)) } },
				{ $group: { _id: dayGroup('apprehension_date'), value: { $sum: 1 } } }
			],
			recent: [
				{ $match: { apprehension_date: { $lt: manilaDayStart(-1) } } },
				{ $sort: { apprehension_date: -1, _id: -1 } },
				{ $limit: 6 },
				{
					$lookup: {
						from: 'violators',
						localField: 'recipient',
						foreignField: '_id',
						as: 'recipient'
					}
				},
				{ $unwind: { path: '$recipient', preserveNullAndEmptyArrays: true } },
				{
					$project: {
						tracking_code: 1,
						status: 1,
						apprehension_date: 1,
						violations_count: { $size: '$violations' },
						amount: { $sum: '$violations.penalty.pecuniary' },
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
						}
					}
				}
			]
		};

		// a leaderboard of one is pointless for 'own' scope
		if (scope !== 'own') {
			facets.top_issuers = [
				{ $match: { apprehension_date: since(month_start) } },
				{ $group: { _id: '$issuer', count: { $sum: 1 } } },
				{ $sort: { count: -1 } },
				{ $limit: 5 },
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
			];
		}

		const [result] = await IssuanceModel.aggregate([{ $match: match }, { $facet: facets }]);

		const counts = new Map<number, number>(
			result.by_status.map((r: { _id: number; count: number }) => [r._id, r.count])
		);
		const by_status = issuance_status_data.map((s) => ({
			value: s.value,
			label: s.label,
			badge_color: s.badge_color,
			count: counts.get(s.value) ?? 0
		}));

		return {
			total: by_status.reduce((sum, s) => sum + s.count, 0),
			this_month: result.this_month[0]?.count ?? 0,
			today: result.today[0]?.count ?? 0,
			by_status,
			trend: fillDays(result.trend),
			recent: JSON.parse(JSON.stringify(result.recent)) as {
				_id: string;
				tracking_code: string;
				status: number;
				apprehension_date: string;
				violations_count: number;
				amount: number;
				recipient_name: string;
			}[],
			top_issuers: result.top_issuers
				? (JSON.parse(JSON.stringify(result.top_issuers)) as {
						_id: string;
						count: number;
						name: string;
					}[])
				: null
		};
	}

	private async billing_section(user: ScopedUser, scope: permission_scope) {
		const match = await billingScopeFilter(user, scope);
		const open = { cancelled: { $ne: true }, payment_status: { $nin: ['PAID', 'CANCELLED'] } };

		const [[totals], [overdue]] = await Promise.all([
			BillingModel.aggregate([
				{ $match: match },
				{
					$facet: {
						collected: [
							{ $match: { cancelled: { $ne: true } } },
							{ $group: { _id: null, total: { $sum: '$amount_paid' } } }
						],
						outstanding: [
							{ $match: open },
							{
								$group: {
									_id: '$payment_status',
									balance: { $sum: '$balance' },
									count: { $sum: 1 }
								}
							}
						]
					}
				}
			]),
			BillingModel.aggregate([
				{ $match: { ...match, ...open } },
				{ $unwind: '$violations' },
				{
					$match: {
						'violations.penalty.surcharge.type': { $in: ['fixed', 'percentage'] },
						'violations.penalty.surcharge.surcharge_due_date': { $ne: null, $lt: new Date() },
						// not yet applied = still "becoming overdue", not already penalized
						'violations.penalty.surcharge.surcharge_applied_date': null
					}
				},
				{
					$group: {
						_id: '$_id',
						issuance: { $first: '$issuance' },
						balance: { $first: '$balance' },
						earliest_due_date: { $min: '$violations.penalty.surcharge.surcharge_due_date' }
					}
				},
				{
					$facet: {
						total: [{ $count: 'count' }],
						items: [
							{ $sort: { earliest_due_date: 1 } },
							{ $limit: 5 },
							{
								$lookup: {
									from: 'issuances',
									localField: 'issuance',
									foreignField: '_id',
									as: 'issuance'
								}
							},
							{ $unwind: '$issuance' },
							{
								$project: {
									balance: 1,
									earliest_due_date: 1,
									tracking_code: '$issuance.tracking_code'
								}
							}
						]
					}
				}
			])
		]);

		const by_status = totals.outstanding as { _id: string; balance: number; count: number }[];
		const outstanding = by_status.reduce((sum, s) => sum + s.balance, 0);
		const collected = totals.collected[0]?.total ?? 0;

		return {
			outstanding,
			open_count: by_status.reduce((sum, s) => sum + s.count, 0),
			collected,
			collection_rate: collected + outstanding > 0 ? collected / (collected + outstanding) : null,
			by_status: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'].map((status) => {
				const row = by_status.find((s) => s._id === status);
				return { status, balance: row?.balance ?? 0, count: row?.count ?? 0 };
			}),
			overdue_count: overdue.total[0]?.count ?? 0,
			overdue: JSON.parse(JSON.stringify(overdue.items)) as {
				_id: string;
				balance: number;
				earliest_due_date: string;
				tracking_code: string;
			}[]
		};
	}

	private async payment_section(user: ScopedUser, scope: permission_scope) {
		const match = await scopeFilter(user, scope, { ownField: 'created_by' });
		const sumSince = (date: Date) => [
			{ $match: { payment_date: since(date) } },
			{ $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
		];

		const [result] = await PaymentModel.aggregate([
			{ $match: match },
			{
				$facet: {
					today: sumSince(manilaDayStart()),
					week: sumSince(manilaDayStart(6)),
					month: sumSince(manilaMonthStart()),
					trend: [
						{ $match: { payment_date: since(manilaDayStart(TREND_DAYS - 1)) } },
						{ $group: { _id: dayGroup('payment_date'), value: { $sum: '$amount' } } }
					],
					recent: [
						{ $match: { payment_date: { $lt: manilaDayStart(-1) } } },
						{ $sort: { payment_date: -1, _id: -1 } },
						{ $limit: 5 },
						{
							$project: {
								tracking_code: 1,
								amount: 1,
								payment_method: 1,
								payment_date: 1,
								issuance: 1
							}
						}
					]
				}
			}
		]);

		const pick = (rows: { total: number; count: number }[]) => ({
			total: rows[0]?.total ?? 0,
			count: rows[0]?.count ?? 0
		});

		return {
			today: pick(result.today),
			week: pick(result.week),
			month: pick(result.month),
			trend: fillDays(result.trend),
			recent: JSON.parse(JSON.stringify(result.recent)) as {
				_id: string;
				tracking_code: string;
				amount: number;
				payment_method: string;
				payment_date: string;
				issuance: string;
			}[]
		};
	}
}

export const DashboardService = new DashboardServiceClass();
