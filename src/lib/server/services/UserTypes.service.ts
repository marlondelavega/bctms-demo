import mongoose, { type PipelineStage } from 'mongoose';
import UserTypesModel from '../models/UserTypes.model';
import { parseSearchParams } from '$lib/utilities/helper';
import type UserType from '$lib/validation_schemas/UserTypes.zod';
import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
import type User from '$lib/validation_schemas/Users.zod';

export async function getUserTypes(_q: URLSearchParams, scopeFilter: Record<string, unknown> = {}) {
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

	if (_q.has('access_level')) {
		const access_level = parseInt(_q.get('access_level') as string);
		matchFilter.access_level = { $gte: access_level };
	}

	const pipeline: PipelineStage[] = [
		{
			$addFields: {
				combinedText: { $concat: [{ $toString: '$_id' }, ' ', '$user_type', ' ', '$role'] }
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

	const res = await UserTypesModel.aggregate<{ count: { total: number }; data: UserType.Base[] }>(
		pipeline
	).exec();

	const result = res[0] ?? { count: 0, data: [] };

	return {
		total: result.count ?? 0,
		data: result.data
	};
}

export async function getUserType_byId(_id: string) {
	return UserTypesModel.findById(_id).lean();
}

export async function createUserType(
	data: UserType.Create,
	user: User.Base<EnforcementGroup.Base, UserType.Base> | undefined
) {
	return UserTypesModel.create({ ...data, created_by: user?._id });
}

export async function updateUserType(data: UserType.Edit) {
	const update = UserTypesModel.findOneAndUpdate(
		{ _id: new mongoose.Types.ObjectId(data._id) },
		{ ...data },
		{ new: true }
	);

	return update;
}

export async function archiveUserTypes(archive_ids: string[]) {
	const archive = await UserTypesModel.updateMany(
		{ _id: { $in: archive_ids } },
		{ $set: { archived: true } }
	);

	return archive;
}

export async function restoreUserTypes(restore_ids: string[]) {
	// [ '6927c32b68ff44a97c44c1d0,69251b7c8c4829f92381ebf1' ]

	const archive = await UserTypesModel.updateMany(
		{ _id: { $in: restore_ids } },
		{ $set: { archived: false } }
	);

	return archive;
}
