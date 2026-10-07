import { parseSearchParams } from '$lib/utilities/helper';
import type { PipelineStage } from 'mongoose';
import BillingModel from '../models/Billing.model';
import type Billing from '$lib/validation_schemas/Billing.zod';
import '$lib/server/models/TicketAssignments.model';
import '$lib/server/models/Tickets.model';
import '$lib/server/models/Users.model';
import '$lib/server/models/Violators.model';
import '$lib/server/models/Issuance.model';

export async function getBillings(
	params: URLSearchParams,
	scopeFilter: Record<string, unknown> = {}
) {
	const { skip, limit, search } = parseSearchParams(params);

	const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

	const match: Record<string, unknown> = { ...scopeFilter };

	const searchStages: PipelineStage[] = search
		? [
				{
					$lookup: {
						from: 'violators',
						localField: 'recipient',
						foreignField: '_id',
						as: '_recipientForSearch'
					}
				},
				{ $unwind: { path: '$_recipientForSearch', preserveNullAndEmptyArrays: true } },

				{
					$lookup: {
						from: 'issuances',
						localField: 'issuance',
						foreignField: '_id',
						as: '_issuanceForSearch',
						pipeline: [
							{
								$lookup: {
									from: 'ticket_assignments',
									localField: 'ticket_assignment',
									foreignField: '_id',
									as: 'ticket_assignment',
									pipeline: [
										{
											$lookup: {
												from: 'tickets',
												localField: 'ticket',
												foreignField: '_id',
												as: 'ticket'
											}
										},
										{ $unwind: { path: '$ticket', preserveNullAndEmptyArrays: true } }
									]
								}
							},
							{ $unwind: { path: '$ticket_assignment', preserveNullAndEmptyArrays: true } },
							{
								$lookup: {
									from: 'users',
									localField: 'issuer',
									foreignField: '_id',
									as: 'issuer'
								}
							},
							{ $unwind: { path: '$issuer', preserveNullAndEmptyArrays: true } }
						]
					}
				},
				{ $unwind: { path: '$_issuanceForSearch', preserveNullAndEmptyArrays: true } },

				{
					$addFields: {
						combinedText: {
							$concat: [
								{ $ifNull: [{ $toString: '$_id' }, ''] },
								' ',
								{ $ifNull: ['$_recipientForSearch.firstname', ''] },
								' ',
								{ $ifNull: ['$_recipientForSearch.lastname', ''] },
								' ',
								{ $ifNull: ['$_issuanceForSearch.ticket_assignment.ticket.name', ''] },
								' ',
								{ $ifNull: ['$_issuanceForSearch.ticket_assignment.ticket.series', ''] },
								' ',
								{ $ifNull: ['$_issuanceForSearch.issuer.firstname', ''] },
								' ',
								{ $ifNull: ['$_issuanceForSearch.issuer.lastname', ''] }
							]
						}
					}
				},
				{
					$match: {
						combinedText: { $regex: escapeRegex(search), $options: 'i' }
					}
				},
				{ $unset: ['combinedText', '_recipientForSearch', '_issuanceForSearch'] }
			]
		: [];

	const pipeline: PipelineStage[] = [
		...(Object.keys(match).length ? [{ $match: match }] : []),
		...searchStages,
		{ $sort: { _id: -1 } },

		{
			$facet: {
				count: [{ $count: 'total' }],
				data: [
					{ $skip: skip },
					{ $limit: limit },

					{
						$lookup: {
							from: 'issuances',
							localField: 'issuance',
							foreignField: '_id',
							as: 'issuance',
							pipeline: [
								{
									$lookup: {
										from: 'ticket_assignments',
										localField: 'ticket_assignment',
										foreignField: '_id',
										as: 'ticket_assignment',
										pipeline: [
											{
												$lookup: {
													from: 'tickets',
													localField: 'ticket',
													foreignField: '_id',
													as: 'ticket'
												}
											},
											{
												$unwind: {
													path: '$ticket',
													preserveNullAndEmptyArrays: true
												}
											}
										]
									}
								},
								{
									$unwind: {
										path: '$ticket_assignment',
										preserveNullAndEmptyArrays: true
									}
								},
								{
									$lookup: {
										from: 'users',
										localField: 'issuer',
										foreignField: '_id',
										as: 'issuer'
									}
								},
								{ $unwind: { path: '$issuer', preserveNullAndEmptyArrays: true } }
							]
						}
					},
					{ $unwind: { path: '$issuance', preserveNullAndEmptyArrays: true } },

					{
						$lookup: {
							from: 'issuances',
							localField: 'reissued_from',
							foreignField: '_id',
							as: 'reissued_from'
						}
					},
					{ $unwind: { path: '$reissued_from', preserveNullAndEmptyArrays: true } },

					{
						$lookup: {
							from: 'violators',
							localField: 'recipient',
							foreignField: '_id',
							as: 'recipient'
						}
					},
					{ $unwind: { path: '$recipient', preserveNullAndEmptyArrays: true } }
				]
			}
		},
		{
			$project: {
				count: { $first: '$count.total' },
				data: 1
			}
		}
	];

	const res = await BillingModel.aggregate<{
		count: { total: number };
		data: Billing.Base[];
	}>(pipeline).exec();

	const result = res[0] ?? { count: 0, data: [] };

	return {
		total: result.count ?? 0,
		data: result.data
	};
}

export async function getBilling_byId(_id: string) {
	const q = BillingModel.findById(_id)
		.populate('recipient')
		.populate({
			path: 'issuance',
			populate: [
				{
					path: 'ticket_assignment',
					populate: {
						path: 'ticket'
					}
				},
				{
					path: 'issuer'
				}
			]
		})
		.lean<Billing.Base>();
	return q;
}

export async function getBilling_byIssuance(issuance_id: string) {
	const q = BillingModel.findOne({ issuance: issuance_id }).lean<Billing.Base>();
	return q ?? {};
}
