/* eslint-disable @typescript-eslint/no-namespace */
import { z } from 'zod/v4';

namespace EnforcementGroup {
	// schemas
	export const Schema = z.object({
		_id: z.string().nonempty(),
		name: z
			.string()
			.nonempty('Name is required.')
			.min(3, 'Name must contain at least 3 characters.')
			.regex(/[a-zA-Z]/, 'Name must contain at least 1 letter (a-z).'),
		description: z.string().nonempty('Description is required.'),
		archived: z.boolean()
	});
	export const CreateSchema = Schema.omit({ _id: true, archived: true });
	export const EditSchema = Schema.omit({ archived: true });
	export const ArchiveSchema = z.object({
		_ids: z.array(z.string())
	});

	export const IncentiveSchema = z
		.object({
			_id: z.string().nonempty(),
			enabled: z.boolean().default(true),
			rate_type: z.enum(['percentage', 'fixed'], 'Choose percentage or fixed per ticket.'),
			amount: z
				.number('Amount is required.')
				.positive('Amount must be greater than zero.')
				.max(1_000_000, 'Amount is too large.'),
			basis: z.enum(['issued', 'paid'], 'Choose issued or paid tickets.')
		})
		.refine((d) => d.rate_type !== 'percentage' || d.amount <= 100, {
			message: 'A percentage cannot be more than 100.',
			path: ['amount']
		});

	// types
	export type Create = z.infer<typeof CreateSchema>;
	export type Edit = z.infer<typeof EditSchema>;
	export type Archive = z.infer<typeof ArchiveSchema>;
	export type Restore = z.infer<typeof ArchiveSchema>;
	export type Incentive = z.infer<typeof IncentiveSchema>;
	export type IncentiveSettings = {
		enabled: boolean;
		rate_type: 'percentage' | 'fixed';
		amount: number;
		basis: 'issued' | 'paid';
		updated_by?: string | null;
		updated_at?: Date | string;
	};
	export type Base = {
		_id: string;
		name: string;
		description: string;
		date_created: Date;
		archived: boolean;
		incentive?: IncentiveSettings | null;
	};
}

export default EnforcementGroup;
