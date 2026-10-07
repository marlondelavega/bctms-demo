import z from 'zod/v4';
import type Issuance from './Issuances.zod';
import type Violator from './Violators.zod';
import type Violation from './Violations.zod';

/* eslint-disable @typescript-eslint/no-namespace */

namespace Billing {
	export const ViolationSnapshot = z.object({
		code_provision: z.string(),
		code: z.string(),
		description: z.string(),
		descriptor: z.string(),
		level: z.number().optional(),
		penalty: z.object({
			pecuniary: z.number(),
			disciplinary: z.string(),
			surcharge: z.object({
				type: z.enum(['fixed', 'percentage']),
				value: z.number().default(0),
				applied_after_days: z.number().default(0),
				applied_every_after: z.number().default(0),
				surcharge_due_date: z.date(),
				surcharge_applied_date: z.date(),
				surcharge_amount: z.number()
			})
		}),
		violation_category: z.object({
			name: z.string().nonempty(),
			description: z.string().trim()
		}),
		violation_sub_category: z.object({
			name: z.string().trim()
		}),
		enforcement_group: z.object({
			name: z.string(),
			description: z.string()
		})
	});

	export const Schema = z.object({
		_id: z.string().nonempty(),
		issuance: z.string().nonempty('Issuance is required.'),
		recipient: z.string().nonempty('Recipient is required.'),

		violations: z.array(ViolationSnapshot),

		violations_total_amount: z.number(),

		payment_status: z
			.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'])
			.default('UNPAID'),
		amount_paid: z.number().default(0),
		balance: z.number(),

		cancelled: z.boolean().default(false),
		cancelled_date: z.date().optional(),
		cancellation_reason: z.string()
	});

	export const CreateSchema = Schema.omit({
		_id: true,
		cancelled: true,
		cancelled_date: true,
		cancellation_reason: true
	});
	export const EditSchema = Schema;
	export const ArchiveSchema = z.object({
		_ids: z.array(z.string())
	});

	export type Create = z.infer<typeof CreateSchema>;
	export type Edit = z.infer<typeof EditSchema>;
	export type Archive = z.infer<typeof ArchiveSchema>;
	export type Restore = z.infer<typeof ArchiveSchema>;
	export type Base<_Issuance = string | Issuance.Base, _Recipient = string | Violator.Base> = {
		_id: string;
		issuance: _Issuance;
		recipient: _Recipient;
		violations: Violation.BillingSnapshot[];
		violations_total_amount: number;
		payment_status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
		amount_paid: number;
		balance: number;
		cancelled: boolean;
		cancelled_date: Date;
		cancellation_reason: string;
	};

	export type Private = Base & {
		created_at?: Date;
		updated_at?: Date;
	};
}

export default Billing;
