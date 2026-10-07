import mongoose, { type PipelineStage } from 'mongoose';
import ViolatorsModel from '../models/Violators.model';
import { escapeRegex, parseSearchParams } from '$lib/utilities/helper';
import type Violator from '$lib/validation_schemas/Violators.zod';
import type User from '$lib/validation_schemas/Users.zod';
import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
import type UserType from '$lib/validation_schemas/UserTypes.zod';

export async function getViolators(_q: URLSearchParams, scopeFilter: Record<string, unknown> = {}) {
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

	if (_q.get('region') && _q.get('region') !== '') matchFilter.address_region = _q.get('region');
	if (_q.get('city') && _q.get('city') !== '') matchFilter.address_city = _q.get('city');
	const barangay = _q.get('barangay')?.trim();
	if (barangay) {
		matchFilter.address_barangay = { $regex: `^${escapeRegex(barangay)}$`, $options: 'i' };
	}

	const pipeline: PipelineStage[] = [
		{
			$addFields: {
				combinedText: {
					$concat: [{ $toString: '$_id' }, '$firstname', '$middlename', '$lastname']
				}
			}
		},
		{ $match: matchFilter },
		{ $sort: { _id: -1 } },
		{
			$unset: 'combinedText'
		},
		{
			$facet: {
				count: [{ $count: 'total' }],
				data: [{ $skip: skip }, { $limit: limit }]
			}
		},
		{
			$project: {
				count: { $first: '$count.total' },
				data: 1
			}
		}
	];

	const res = await ViolatorsModel.aggregate<{
		count: number | null;
		data: Violator.Base[];
	}>(pipeline).exec();

	const result = res[0] ?? { count: 0, data: [] };

	return {
		total: result.count ?? 0,
		data: result.data
	};
}

export async function getViolator_byId(_id: string) {
	return ViolatorsModel.findById(_id).lean();
}

export async function createViolator(
	data: Violator.Create,
	user: User.Base<EnforcementGroup.Base, UserType.Base> | undefined
) {
	return ViolatorsModel.create({ ...data, created_by: user?._id });
}

export async function updateViolator(data: Violator.Edit) {
	const update = ViolatorsModel.findOneAndUpdate(
		{ _id: new mongoose.Types.ObjectId(data._id) },
		{ ...data },
		{ new: true }
	);

	return update;
}

export async function archiveViolators(archive_ids: string[]) {
	const archive = await ViolatorsModel.updateMany(
		{ _id: { $in: archive_ids } },
		{ $set: { archived: true } }
	);

	return archive;
}

export async function restoreViolators(restore_ids: string[]) {
	const archive = await ViolatorsModel.updateMany(
		{ _id: { $in: restore_ids } },
		{ $set: { archived: false } }
	);

	return archive;
}
