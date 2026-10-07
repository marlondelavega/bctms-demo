import mongoose, { type PipelineStage } from 'mongoose';
import CodeProvisionsModel from '../models/CodeProvision.model';

import { parseSearchParams } from '$lib/utilities/helper';
import type CodeProvision from '$lib/validation_schemas/CodeProvisions.zod';
import type User from '$lib/validation_schemas/Users.zod';
import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
import type UserType from '$lib/validation_schemas/UserTypes.zod';

export async function getCodeProvisions(_q: URLSearchParams) {
	const { skip, limit, search, archived } = parseSearchParams(_q);

	const matchFilter: Record<string, unknown> = {
		combinedText: { $regex: search, $options: 'i' }
	};

	if (archived === -1) {
		matchFilter.archived = true;
	} else if (archived === 1) {
		matchFilter.archived = { $in: [false, null] };
	}

	if (_q.get('enforcement_group')) {
		matchFilter.enforcement_group = new mongoose.Types.ObjectId(_q.get('enforcement_group')!);
	}

	if (_q.get('created_by')) {
		matchFilter.created_by = new mongoose.Types.ObjectId(_q.get('created_by')!);
	}

	const pipeline: PipelineStage[] = [
		{
			$addFields: {
				combinedText: { $concat: [{ $toString: '$_id' }, '$code', '$descriptor', '$description'] }
			}
		},
		{ $match: matchFilter },
		{ $sort: { _id: -1 } },
		{
			$lookup: {
				from: 'users',
				localField: 'created_by',
				foreignField: '_id',
				as: 'created_by'
			}
		},
		{
			$lookup: {
				from: 'violation_categories',
				localField: 'violation_category',
				foreignField: '_id',
				as: 'violation_category'
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
					{ $unwind: { path: '$created_by', preserveNullAndEmptyArrays: true } },
					{ $unwind: { path: '$violation_category', preserveNullAndEmptyArrays: true } }
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

	const res = await CodeProvisionsModel.aggregate<{
		count: { total: number };
		data: CodeProvision.Base[];
	}>(pipeline).exec();

	const result = res[0] ?? { count: 0, data: [] };

	return {
		total: result.count ?? 0,
		data: result.data
	};
}

export async function getCodeProvisions_byCategory() {
	const grouped = await CodeProvisionsModel.aggregate([
		// 1. Filter out archived
		{ $match: { archived: false } },

		// 2. Lookup the parent violation_category (which contains sub_categories array)
		{
			$lookup: {
				from: 'violation_categories',
				localField: 'violation_category',
				foreignField: '_id',
				as: 'category'
			}
		},
		{ $unwind: '$category' },

		// 3. Unwind the sub_categories array inside the category
		{ $unwind: '$category.sub_categories' },

		// 4. Match only the sub_category that belongs to this provision
		{
			$match: {
				$expr: {
					$eq: ['$category.sub_categories._id', '$violation_sub_category']
				}
			}
		},

		// 5. Group by sub_category
		{
			$group: {
				_id: '$category.sub_categories._id',
				sub_category_name: { $first: '$category.sub_categories.name' },
				main_category: { $first: '$category.name' }, // useful for display
				provisions: {
					$push: {
						_id: '$_id',
						code: '$code',
						description: '$description',
						descriptor: '$descriptor',
						penalty: '$penalty'
					}
				}
			}
		},

		// 6. Clean up shape
		{
			$project: {
				_id: 0,
				sub_category_id: '$_id',
				sub_category_name: 1,
				main_category: 1,
				provisions: 1
			}
		},

		{ $sort: { sub_category_name: 1 } }
	]);
	return grouped;
}

export async function getCodeProvision_byId(_id: string) {
	return CodeProvisionsModel.findById(_id).lean();
}

export async function getCodeProvision_byCode(code: string) {
	return CodeProvisionsModel.find({ code });
}

export async function createCodeProvision(
	data: CodeProvision.Create,
	user: User.Base<EnforcementGroup.Base, UserType.Base> | undefined
) {
	const q = CodeProvisionsModel.create({ ...data, created_by: user?._id });
	return q;
}

export async function updateCodeProvision(data: CodeProvision.Edit) {
	const update = CodeProvisionsModel.findOneAndUpdate(
		{ _id: new mongoose.Types.ObjectId(data._id) },
		{ ...data },
		{ new: true }
	);

	return update;
}

export async function archiveCodeProvisions(archive_ids: string[]) {
	const archive = CodeProvisionsModel.updateMany(
		{ _id: { $in: archive_ids } },
		{ $set: { archived: true } }
	);

	return archive;
}

export async function restoreCodeProvisions(restore_ids: string[]) {
	const restore = CodeProvisionsModel.updateMany(
		{ _id: { $in: restore_ids } },
		{
			$set: { archived: false }
		}
	);

	return restore;
}
