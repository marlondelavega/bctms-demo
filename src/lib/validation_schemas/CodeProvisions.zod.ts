/* eslint-disable @typescript-eslint/no-namespace */
import z from 'zod';
import type User from './Users.zod';
import type ViolationCategory from './ViolationCategories.zod';
import type EnforcementGroup from './EnforcementGroups.zod';
import type { Penalty } from '$lib/server/models/CodeProvision.model';

namespace CodeProvision {
	export const SurchargeSchema = z.object({
		type: z.enum(['fixed', 'percentage']).optional().default('fixed'),
		value: z
			.number('Surcharge value must be a number.')
			.optional()
			.nullable()
			.transform((val) => (val == null ? 0 : val))
			.default(0),
		applied_after_days: z
			.number('Surcharge days applied must be a number.')
			.optional()
			.nullable()
			.transform((val) => (val == null ? 0 : val))
			.default(30),
		applied_every_after: z
			.number('Surcharge every after days must be a number.')
			.optional()
			.nullable()
			.transform((val) => (val == null ? 0 : val))
			.default(30)
	});

	export const PenaltySchema = z.object({
		pecuniary: z
			.number('Pecuniary penalty must be a number.')
			.optional()
			.nullable()
			.transform((val) => (val === null ? 0 : val))
			.default(0),
		disciplinary: z.string('Disciplinary penalty must be a string.').optional().default(''),
		surcharge: SurchargeSchema.optional()
	});

	const hasPenalty = ({ pecuniary, disciplinary }: z.infer<typeof PenaltySchema>) =>
		(pecuniary ?? 0) !== 0 || (disciplinary ?? '').trim() !== '';

	// The Nth offense uses penalty[N - 1], and the last one keeps applying after that, so the order
	// is meaningful: blank offenses at the end are dropped, but a blank one in between (or an
	// incomplete surcharge) is an error rather than something to quietly remove and shift the rest up.
	const PenaltiesSchema = z
		.array(PenaltySchema)
		.superRefine((arr, ctx) => {
			const last_filled = arr.findLastIndex(hasPenalty);

			if (last_filled < 0) {
				ctx.addIssue({
					code: 'custom',
					message: 'Enter a fine or a disciplinary action for at least the 1st offense.',
					path: []
				});
				return;
			}

			arr.slice(0, last_filled + 1).forEach((p, i) => {
				if (!hasPenalty(p)) {
					ctx.addIssue({
						code: 'custom',
						message: 'Enter a fine or a disciplinary action, or remove this offense.',
						path: [i, 'pecuniary']
					});
				}

				if ((p.pecuniary ?? 0) < 0) {
					ctx.addIssue({
						code: 'custom',
						message: 'The fine cannot be negative.',
						path: [i, 'pecuniary']
					});
				}

				const sc = p.surcharge;
				if (!sc) return;

				if (sc.value < 1) {
					ctx.addIssue({
						code: 'custom',
						message: 'Enter a surcharge of at least 1.',
						path: [i, 'surcharge', 'value']
					});
				} else if (sc.type === 'percentage' && sc.value > 100) {
					ctx.addIssue({
						code: 'custom',
						message: 'A percentage surcharge cannot be more than 100.',
						path: [i, 'surcharge', 'value']
					});
				}
				if (sc.applied_after_days < 1) {
					ctx.addIssue({
						code: 'custom',
						message: 'Enter at least 1 day.',
						path: [i, 'surcharge', 'applied_after_days']
					});
				}
				if (sc.applied_every_after < 1) {
					ctx.addIssue({
						code: 'custom',
						message: 'Enter at least 1 day.',
						path: [i, 'surcharge', 'applied_every_after']
					});
				}
			});
		})
		.transform((arr) => arr.slice(0, arr.findLastIndex(hasPenalty) + 1));

	export const Schema = z.object({
		_id: z.string().nonempty(),
		code: z.string().trim().nonempty('Code is required.'),
		description: z
			.string()
			.nonempty('Description is required.')
			.min(3, 'Description must contain at least 3 characters.')
			.regex(/[a-zA-Z]/, 'Name must contain at least 1 letter (a-z).'),
		descriptor: z.string('Must be a valid descriptor.').trim().nonempty('Descriptor is required.'),
		violation_category: z.string().nonempty('Violation category is required.'),
		violation_sub_category: z.string().nonempty('Sub-category is required.'),
		enforcement_group: z.string().nonempty('Enforcement group is required.'),
		penalty: PenaltiesSchema,
		archived: z.boolean()
	});
	export const CreateSchema = Schema.omit({ _id: true, archived: true });
	export const EditSchema = Schema.omit({ archived: true });
	export const ArchiveSchema = z.object({
		_ids: z.array(z.string()).min(1, 'At least one item is required')
	});

	export type Create = z.infer<typeof CreateSchema>;
	export type Edit = z.infer<typeof EditSchema>;
	export type Archive = z.infer<typeof ArchiveSchema>;
	export type Restore = z.infer<typeof ArchiveSchema>;
	export type Base<
		C = string | User.Base,
		V = string | ViolationCategory.Base,
		E = string | EnforcementGroup.Base,
		_Penalty = Penalty
	> = {
		_id: string;
		code: string;
		description: string;
		descriptor: string;
		created_by: C;
		violation_category: V;
		enforcement_group: E;
		violation_sub_category: string;
		penalty: _Penalty;
		archived: boolean;
	};

	export type ByCategory = {
		main_category: string;
		sub_category_id: string;
		sub_category_name: string;
		provisions: Base[];
	};
}

export default CodeProvision;
