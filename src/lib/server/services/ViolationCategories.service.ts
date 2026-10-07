import mongoose, { type PipelineStage } from 'mongoose';
import ViolationCategoryModel from '../models/ViolationCategories.model';
import { parseSearchParams } from '$lib/utilities/helper';
import type ViolationCategory from '$lib/validation_schemas/ViolationCategories.zod';
import type User from '$lib/validation_schemas/Users.zod';
import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
import type UserType from '$lib/validation_schemas/UserTypes.zod';

export async function getViolationCategories(
	_q: URLSearchParams,
	scopeFilter: Record<string, unknown> = {}
) {
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

	const pipeline: PipelineStage[] = [
		{
			$addFields: {
				combinedText: {
					$concat: [
						{ $toString: '$_id' },
						' ',
						'$name',
						' ',
						'$description',
						' ',
						{
							$reduce: {
								input: '$sub_categories',
								initialValue: '',
								in: {
									$concat: ['$$value', ' ', '$$this.name']
								}
							}
						}
					]
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

	const res = await ViolationCategoryModel.aggregate<{
		count: number | null;
		data: ViolationCategory.Base[];
	}>(pipeline).exec();

	const result = res[0] ?? { count: 0, data: [] };

	return {
		total: result.count ?? 0,
		data: result.data
	};
}

export async function getViolationCategory_byId(_id: string) {
	return ViolationCategoryModel.findById(_id).lean();
}

export async function createViolationCategory(
	data: ViolationCategory.Create,
	user: User.Base<EnforcementGroup.Base, UserType.Base> | undefined
) {
	return ViolationCategoryModel.create({ ...data, created_by: user?._id });
}

export async function updateViolationCategory(data: ViolationCategory.Edit) {
	const update = ViolationCategoryModel.findOneAndUpdate(
		{ _id: new mongoose.Types.ObjectId(data._id) },
		{ ...data },
		{ new: true }
	);

	return update;
}

export async function archiveViolationCategories(archive_ids: string[]) {
	const archive = await ViolationCategoryModel.updateMany(
		{ _id: { $in: archive_ids } },
		{ $set: { archived: true } }
	);

	return archive;
}

export async function restoreViolationCategories(restore_ids: string[]) {
	const archive = await ViolationCategoryModel.updateMany(
		{ _id: { $in: restore_ids } },
		{ $set: { archived: false } }
	);

	return archive;
}
