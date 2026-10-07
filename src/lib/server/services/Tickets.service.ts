import mongoose, { type PipelineStage } from 'mongoose';
import TicketsModel from '../models/Tickets.model';
import type Ticket from '$lib/validation_schemas/Tickets.zod';
import { parseSearchParams } from '$lib/utilities/helper';
import type User from '$lib/validation_schemas/Users.zod';
import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
import type UserType from '$lib/validation_schemas/UserTypes.zod';

export async function getTickets(_q: URLSearchParams, scopeFilter: Record<string, unknown> = {}) {
	const { skip, limit, search, archived } = parseSearchParams(_q);

	const matchFilter: Record<string, unknown> = {
		combinedText: { $regex: search, $options: 'i' },
		...scopeFilter
	};

	if (archived === -1) {
		matchFilter.archived = true;
	} else if (archived === 1) {
		matchFilter.archived = { $in: [false, null] };
	}

	if (_q.get('withdrawn') && _q.get('withdrawn') !== '') {
		matchFilter.ticket_for = { $exists: true, $ne: null };
		matchFilter.in_charge = { $exists: true, $ne: null };
		matchFilter.date_withdrawn = { $exists: true, $ne: null };
	}

	const pipeline: PipelineStage[] = [
		{
			$addFields: {
				combinedText: {
					$concat: [
						{ $toString: '$_id' },
						' ',
						'$name',
						' ',
						{ $toString: '$ticket_num_from' },
						' ',
						{ $toString: '$ticket_num_from' }
					]
				}
			}
		},
		{
			$match: matchFilter
		},
		{ $sort: { _id: -1 } },
		{
			$lookup: {
				from: 'enforcement_groups',
				localField: 'ticket_for',
				foreignField: '_id',
				as: 'ticket_for'
			}
		},
		{
			$lookup: {
				from: 'users',
				localField: 'in_charge',
				foreignField: '_id',
				as: 'in_charge'
			}
		},
		{
			$unset: 'combinedText'
		},
		{
			$facet: {
				count: [{ $count: 'total' }],
				data: [
					{ $skip: skip },
					{ $limit: limit },
					{ $unwind: { path: '$ticket_for', preserveNullAndEmptyArrays: true } },
					{ $unwind: { path: '$in_charge', preserveNullAndEmptyArrays: true } }
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

	const res = await TicketsModel.aggregate<{ count: { total: number }; data: Ticket.Base[] }>(
		pipeline
	).exec();

	const result = res[0] ?? { count: 0, data: [] };

	return {
		total: result.count ?? 0,
		data: result.data
	};
}

export async function getTicket_byId(_id: string) {
	const _r = await TicketsModel.findById(_id)
		.populate('ticket_for')
		.populate('in_charge')
		.lean<Ticket.Base<EnforcementGroup.Base, User.Base>>();
	return _r;
}

export async function getTicket_byName(name: string) {
	return TicketsModel.find({ name });
}

export async function createTicket(
	data: Ticket.Create,
	user: User.Base<EnforcementGroup.Base, UserType.Base> | undefined
) {
	const _q = TicketsModel.create({ ...data, created_by: user?._id });
	return _q;
}

export async function updateTicket(data: Ticket.Edit) {
	const _u = TicketsModel.findOneAndUpdate(
		{ _id: new mongoose.Types.ObjectId(data._id) },
		{ ...data },
		{ new: true }
	);

	return _u;
}

export async function updateManyTickets(data: Ticket.Withdraw) {
	const _u = TicketsModel.updateMany(
		{ _id: { $in: data._ids } },
		{
			date_withdrawn: data.date_withdrawn,
			in_charge: data.in_charge,
			ticket_for: data.ticket_for,
			withdrawn: true
		}
	);

	return _u;
}

export async function availableTickets(_ids: string[]) {
	const _u = TicketsModel.find({
		_id: { $in: _ids },
		$and: [
			{ date_withdrawn: { $not: { $gt: '' } } },
			{ in_charge: undefined },
			{ ticket_for: undefined }
		]
	});

	return _u;
}

export async function archiveTickets(archive_ids: string[]) {
	const _a = TicketsModel.updateMany({ _id: { $in: archive_ids } }, { $set: { archived: true } });

	return _a;
}

export async function restoreTickets(restore_ids: string[]) {
	const _r = TicketsModel.updateMany({ _id: { $in: restore_ids } }, { $set: { archived: false } });

	return _r;
}
