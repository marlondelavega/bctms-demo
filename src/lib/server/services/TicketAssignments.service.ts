import type TicketAssignment from '$lib/validation_schemas/TicketAssignments.zod';
import { type PipelineStage } from 'mongoose';
import TicketAssignmentsModel from '../models/TicketAssignments.model';
import { parseSearchParams, toObjectId } from '$lib/utilities/helper';
import type User from '$lib/validation_schemas/Users.zod';
import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
import type UserType from '$lib/validation_schemas/UserTypes.zod';
import type Ticket from '$lib/validation_schemas/Tickets.zod';
import IssuanceModel from '../models/Issuance.model';

export async function getTicketAssignments(
	_q: URLSearchParams,
	scopeFilter: Record<string, unknown> = {}
) {
	const { skip, limit, search: _s, archived } = parseSearchParams(_q);
	const search = _s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

	const matchFilter1: Record<string, unknown> = { ...scopeFilter };

	const matchFilter2: Record<string, unknown> = {
		combinedText: { $regex: search, $options: 'i' }
	};

	if (archived === -1) {
		matchFilter1.archived = true;
	} else if (archived === 1) {
		matchFilter1.archived = { $in: [false, null] };
	}

	const ticket_id = toObjectId(_q.get('ticket'));
	if (ticket_id) matchFilter1.ticket = ticket_id;

	const user_id = toObjectId(_q.get('user'));
	if (user_id) matchFilter1.user = user_id;

	const pipeline: PipelineStage[] = [
		{ $match: matchFilter1 },
		{
			$lookup: {
				from: 'tickets',
				localField: 'ticket',
				foreignField: '_id',
				as: 'ticket'
			}
		},
		{
			$lookup: {
				from: 'users',
				localField: 'user',
				foreignField: '_id',
				as: 'user'
			}
		},
		{ $unwind: { path: '$ticket', preserveNullAndEmptyArrays: true } },
		{
			$addFields: {
				combinedText: {
					$concat: [
						{ $toString: '$_id' },
						{ $toString: '$series_from' },
						{ $toString: '$series_to' },
						{ $toString: '$ticket.name' },
						' (',
						{ $toString: '$series_from' },
						'-',
						{ $toString: '$series_to' },
						')'
					]
				}
			}
		},
		{ $match: matchFilter2 },
		{ $sort: { _id: -1 } },
		{
			$unset: 'combinedText'
		},
		{
			$facet: {
				count: [{ $count: 'total' }],
				data: [
					{ $skip: skip },
					{ $limit: limit },
					{ $unwind: { path: '$ticket', preserveNullAndEmptyArrays: true } },
					{ $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
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

	const res = await TicketAssignmentsModel.aggregate<{
		count: number | null;
		data: TicketAssignment.Base[];
	}>(pipeline).exec();

	const result = res[0] ?? { count: 0, data: [] };

	return {
		total: result.count ?? 0,
		data: result.data
	};
}

export async function getTicketAssignmentById(
	_id: string
): Promise<TicketAssignment.Base<User.Base, Ticket.Base, User.Base> | null> {
	const assignment = await TicketAssignmentsModel.findById(_id)
		.populate('ticket')
		.populate('user')
		.populate('assigned_by')
		.lean<TicketAssignment.Base<User.Base, Ticket.Base, User.Base>>()
		.exec();

	return assignment as TicketAssignment.Base<User.Base, Ticket.Base, User.Base> | null;
}

export async function getTicketAssignmentById_Raw(
	_id: string
): Promise<TicketAssignment.Base<string, string, string> | null> {
	const assignment = await TicketAssignmentsModel.findById(_id)
		.lean<TicketAssignment.Base<string, string, string>>()
		.exec();

	return assignment as TicketAssignment.Base<string, string, string> | null;
}

type LeanTicketAssignment = {
	_id: { toString(): string };
	[key: string]: unknown;
};

export async function getTicketAssignmentsWithLockStatus(ticketId: string) {
	const assignments = await TicketAssignmentsModel.find({ ticket: ticketId })
		.populate('user')
		.sort({ series_from: 1 })
		.lean<LeanTicketAssignment[]>();

	const assignment_ids = assignments.map((a) => a._id.toString());

	const locked_ids = await IssuanceModel.aggregate<{ _id: string }>([
		{ $addFields: { ticket_assignment_str: { $toString: '$ticket_assignment' } } },
		{
			$match: {
				ticket_assignment_str: { $in: assignment_ids }
			}
		},
		{ $group: { _id: '$ticket_assignment_str' } }
	]);

	const locked_id_set = new Set<string>(locked_ids.map((l) => l._id));

	return assignments.map((a) => ({
		...a,
		is_locked: locked_id_set.has(a._id.toString())
	}));
}

export async function getLastSeriesNumber(ticket_id: string) {
	const res = await TicketAssignmentsModel.aggregate([
		{
			$match: {
				_id: toObjectId(ticket_id)
			}
		},
		{
			$lookup: {
				from: 'issuances',
				let: {
					seriesFrom: '$series_from',
					seriesTo: '$series_to',
					assignmentId: '$_id'
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ['$ticket_assignment', '$$assignmentId'] },
									{ $gte: ['$ticket_series', '$$seriesFrom'] },
									{ $lte: ['$ticket_series', '$$seriesTo'] }
								]
							}
						}
					}
				],
				as: 'used_series'
			}
		},
		{
			$addFields: {
				full_range: {
					$range: ['$series_from', { $add: ['$series_to', 1] }]
				},
				used_numbers: '$used_series.ticket_series'
			}
		},
		{
			$addFields: {
				available_series: {
					$filter: {
						input: '$full_range',
						as: 'num',
						cond: {
							$not: [{ $in: ['$$num', '$used_numbers'] }]
						}
					}
				}
			}
		},
		{
			$project: {
				_id: 0,
				available_series: 1,
				used_series: '$used_numbers',
				total_used: { $size: '$used_numbers' },
				is_fully_used: {
					$eq: [
						{ $size: '$used_numbers' },
						{ $add: [{ $subtract: ['$series_to', '$series_from'] }, 1] }
					]
				}
			}
		}
	]);

	return res[0];
}

export async function getTicketAssignments_byTicket(ticket_id: string) {
	const q = TicketAssignmentsModel.find<TicketAssignment.Base>({ ticket: ticket_id });

	return q.populate('user').populate('assigned_by');
}

export async function createTicketAssignment(
	data: TicketAssignment.Create,
	user: User.Base<EnforcementGroup.Base, UserType.Base> | undefined
) {
	const c = await TicketAssignmentsModel.create({ ...data, assigned_by: user?._id });
	return c;
}

export async function updateTicketAssignment(data: TicketAssignment.Edit) {
	return TicketAssignmentsModel.findOneAndUpdate(
		{ _id: toObjectId(data._id) },
		{
			ticket: data.ticket,
			user: data.user,
			series_from: data.series_from,
			series_to: data.series_to,
			status: data.status,
			date_assigned: data.date_assigned
		},
		{ new: true }
	);
}

// const res = await TicketAssignmentsModel.aggregate([
// 	{
// 		$match: {
// 			_id: toObjectId(ticket_id)
// 		}
// 	},
// 	{
// 		$lookup: {
// 			from: 'issuances',i
// 			let: {
// 				seriesFrom: '$series_from',
// 				seriesTo: '$series_to'
// 			},
// 			pipeline: [
// 				{
// 					$match: {
// 						$expr: {
// 							$and: [
// 								{ $gte: ['$ticket_series', '$$seriesFrom'] },
// 								{ $lte: ['$ticket_series', '$$seriesTo'] }
// 							]
// 						}
// 					}
// 				}
// 			],
// 			as: 'used_series'
// 		}
// 	},
// 	{
// 		$addFields: {
// 			next_available_series: {
// 				$cond: {
// 					if: { $gt: [{ $size: '$used_series' }, 0] },
// 					then: {
// 						$add: [{ $max: '$used_series.ticket_series' }, 1]
// 					},
// 					else: '$series_from'
// 				}
// 			},
// 			total_used: { $size: '$used_series' },
// 			is_fully_used: {
// 				$eq: [
// 					{ $size: '$used_series' },
// 					{ $add: [{ $subtract: ['$series_to', '$series_from'] }, 1] }
// 				]
// 			},
// 			available_series: {
// 				$range: ['$next_available_series', { $add: ['$series_to', 1] }]
// 			}
// 		}
// 	},
// 	{
// 		$project: {
// 			ticket: 0,
// 			user: 0,
// 			assigned_by: 0,
// 			series_from: 0,
// 			series_to: 0,
// 			status: 0,
// 			date_assigned: 0,
// 			archived: 0
// 		}
// 	}
// ]);
