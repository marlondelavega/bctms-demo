/* eslint-disable @typescript-eslint/no-namespace */
import { z } from 'zod/v4';

namespace ViolationCategory {
	// schemas
	export const SubCategorySchema = z.object({ _id: z.string(), name: z.string().optional() });
	export const CreateSubCategorySchema = SubCategorySchema.omit({ _id: true });

	export const Schema = z.object({
		_id: z.string().nonempty(),
		name: z
			.string()
			.nonempty('Category name is required.')
			.min(3, 'Category name must contain at least 3 characters.')
			.regex(/[a-zA-Z]/, 'Name must contain at least 1 letter (a-z).'),
		description: z.string().nonempty('Category description is required.'),
		sub_categories: z
			.array(CreateSubCategorySchema)
			.refine(
				(arr) => arr.some(({ name }) => name !== ''),
				'Requires at least one (1) valid sub category.'
			)
			.transform((arr) => arr.filter(({ name }) => name !== '')),
		archived: z.boolean()
	});
	export const CreateSchema = Schema.omit({ _id: true, archived: true });
	export const EditSchema = Schema.omit({ archived: true });
	export const ArchiveSchema = z.object({
		_ids: z.array(z.string())
	});

	// types
	export type Create = z.infer<typeof CreateSchema>;
	export type Edit = z.infer<typeof EditSchema>;
	export type Archive = z.infer<typeof ArchiveSchema>;
	export type Restore = z.infer<typeof ArchiveSchema>;
	export type Base = {
		_id: string;
		name: string;
		description: string;
		sub_categories: z.infer<typeof SubCategorySchema>[];
		archived: boolean;
	};
}

export default ViolationCategory;
