import EnforcementGroupsModel from '$lib/server/models/EnforcementGroups.model';
import { parseSearchParams } from '$lib/utilities/helper';
import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
import type User from '$lib/validation_schemas/Users.zod';
import type UserType from '$lib/validation_schemas/UserTypes.zod';
import mongoose, { type PipelineStage } from 'mongoose';

export async function getEnforcementGroups(_q: URLSearchParams) {
	const { skip, limit, search, archived } = parseSearchParams(_q);

	const matchFilter: Record<string, unknown> = {
		combinedText: { $regex: search, $options: 'i' }
	};

	if (archived === -1) {
		matchFilter.archived = true;
	} else if (archived === 1) {
		matchFilter.archived = { $in: [false, null] };
	}

	if (_q.has('enforcement_group')) {
		matchFilter._id = new mongoose.Types.ObjectId(_q.get('enforcement_group') as string);
	}

	if (_q.get('created_by')) {
		matchFilter.created_by = new mongoose.Types.ObjectId(_q.get('created_by')!);
	}

	const pipeline: PipelineStage[] = [
		{
			$addFields: {
				combinedText: { $concat: [{ $toString: '$_id' }, ' ', '$name'] }
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

	const res = await EnforcementGroupsModel.aggregate<{
		count: { total: number };
		data: EnforcementGroup.Base[];
	}>(pipeline).exec();

	const result = res[0] ?? { count: 0, data: [] };

	return {
		total: result.count ?? 0,
		data: result.data
	};
}

export async function getEnforcementGroup_byId(_id: string) {
	return EnforcementGroupsModel.findById(_id).lean();
}

export async function createEnforcementGroup(
	data: EnforcementGroup.Create,
	user: User.Base<EnforcementGroup.Base, UserType.Base> | undefined
) {
	return EnforcementGroupsModel.create({ ...data, created_by: user?._id });
}

export async function updateEnforcementGroup(data: EnforcementGroup.Edit) {
	const update = EnforcementGroupsModel.findOneAndUpdate(
		{ _id: new mongoose.Types.ObjectId(data._id) },
		{ ...data },
		{ new: true }
	);

	return update;
}

export async function archiveEnforcementGroups(archive_ids: string[]) {
	const archive = await EnforcementGroupsModel.updateMany(
		{ _id: { $in: archive_ids } },
		{ $set: { archived: true } }
	);

	return archive;
}

export async function restoreEnforcementGroups(restore_ids: string[]) {
	const archive = await EnforcementGroupsModel.updateMany(
		{ _id: { $in: restore_ids } },
		{ $set: { archived: false } }
	);

	return archive;
}

export async function updateIncentiveSettings(data: EnforcementGroup.Incentive, user_id: string) {
	return EnforcementGroupsModel.findOneAndUpdate(
		{ _id: new mongoose.Types.ObjectId(data._id) },
		{
			$set: {
				incentive: {
					enabled: data.enabled,
					rate_type: data.rate_type,
					amount: data.amount,
					basis: data.basis,
					updated_by: user_id,
					updated_at: new Date()
				}
			}
		},
		{ returnDocument: 'after' }
	).lean();
}
