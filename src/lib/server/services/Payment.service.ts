import { parseDateRange, parseSearchParams } from '$lib/utilities/helper';
import type { PipelineStage } from 'mongoose';
import PaymentModel from '../models/Payments.model';
import Payment from '$lib/validation_schemas/Payments.zod';
import type User from '$lib/validation_schemas/Users.zod';
import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
import type UserType from '$lib/validation_schemas/UserTypes.zod';

// Per-page enrichment: only ever run against the (skip/limit-bounded) page of
// documents, never against the full matching result set.
const pagedLookups: PipelineStage.FacetPipelineStage[] = [
	{
		$lookup: {
			from: 'issuances',
			localField: 'issuance',
			foreignField: '_id',
			as: 'issuance'
		}
	},
	{ $unwind: { path: '$issuance', preserveNullAndEmptyArrays: true } },

	{
		$lookup: {
			from: 'ticket_assignments',
			localField: 'issuance.ticket_assignment',
			foreignField: '_id',
			as: 'ticket_assignment_temp'
		}
	},
	{
		$set: {
			'issuance.ticket_assignment': { $arrayElemAt: ['$ticket_assignment_temp', 0] }
		}
	},
	{ $unset: 'ticket_assignment_temp' },

	{
		$lookup: {
			from: 'tickets',
			localField: 'issuance.ticket_assignment.ticket',
			foreignField: '_id',
			as: 'ticket_temp'
		}
	},
	{
		$set: {
			'issuance.ticket_assignment.ticket': { $arrayElemAt: ['$ticket_temp', 0] }
		}
	},
	{ $unset: 'ticket_temp' },

	{
		$lookup: {
			from: 'billings',
			localField: 'billing',
			foreignField: '_id',
			as: 'billing'
		}
	},
	{ $unwind: { path: '$billing', preserveNullAndEmptyArrays: true } },

	{
		$lookup: {
			from: 'users',
			localField: 'created_by',
			foreignField: '_id',
			as: 'created_by'
		}
	},
	{ $unwind: { path: '$created_by', preserveNullAndEmptyArrays: true } }
];

export async function getPayments(_q: URLSearchParams, scopeFilter: Record<string, unknown> = {}) {
	const { skip, limit, search } = parseSearchParams(_q);

	const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

	const match: Record<string, unknown> = { ...scopeFilter };

	const paid_on = parseDateRange(_q);
	if (paid_on) match.payment_date = paid_on;

	const pipeline: PipelineStage[] = [
		// Cheap filter first — no join dependency. Can use an index on
		// (created_by, _id) for scoped queries.
		...(Object.keys(match).length ? [{ $match: match }] : []),

		// The ticket/issuance joins are only needed to reach ticket.name for
		// search. Only do them ahead of pagination when actually searching —
		// otherwise defer all enrichment lookups to the current page inside
		// $facet, below.
		...(search
			? [
					...pagedLookups,
					{
						$addFields: {
							combinedText: {
								$concat: [
									{ $toString: '$_id' },
									' ',
									{ $ifNull: ['$reference_number', ''] },
									' ',
									{ $ifNull: ['$tracking_code', ''] },
									' ',
									{ $ifNull: ['$payment_method', ''] },
									' ',
									{ $ifNull: ['$issuance.ticket_assignment.ticket.name', ''] }
								]
							}
						}
					},
					{
						$match: {
							combinedText: { $regex: escapeRegex(search), $options: 'i' }
						}
					},
					{ $unset: 'combinedText' }
				]
			: []),

		{ $sort: { _id: -1 } },

		{
			$facet: {
				count: [{ $count: 'total' }],
				data: [
					{ $skip: skip },
					{ $limit: limit },

					// Search path already joined everything above; only run
					// the enrichment lookups here when they haven't run yet.
					...(search ? [] : pagedLookups)
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

	const res = await PaymentModel.aggregate<{ count: { total: number }; data: Payment.Base[] }>(
		pipeline
	).exec();

	const result = res[0] ?? { count: 0, data: [] };

	return {
		total: result.count ?? 0,
		data: result.data
	};
}

export async function getPaymentByReference(reference_number: string) {
	const _r = PaymentModel.findOne({ reference_number })
		.populate('issuance')
		.populate('billing')
		.lean<Payment.Base>();
	return _r;
}

export async function getPayment_byId(_id: string) {
	const _r = PaymentModel.findById(_id)
		.populate({
			path: 'issuance',
			populate: [{ path: 'ticket_assignment', populate: { path: 'ticket' } }, { path: 'recipient' }]
		})
		.populate('billing')
		.lean<Payment.Base>();
	return _r;
}

export async function updatePayment(
	_id: string,
	data: Pick<
		Payment.Edit,
		| 'amount'
		| 'payment_date'
		| 'payment_method'
		| 'payment_method_other'
		| 'reference_number'
		| 'notes'
	>
) {
	const update = PaymentModel.findByIdAndUpdate(
		_id,
		{ $set: data },
		{ new: true }
	).lean<Payment.Base>();
	return update;
}

export async function createPayment(
	data: Payment.Create,
	user: User.Base<EnforcementGroup.Base, UserType.Base> | undefined
) {
	const _q = await PaymentModel.create({ ...data, created_by: user?._id });
	return _q;
}

export async function getPaymentsByIssuance(issuance_id: string) {
	const _r = PaymentModel.find({ issuance: issuance_id })
		.populate('issuance')
		.populate('billing')
		.lean<Payment.Base>();
	return _r;
}
