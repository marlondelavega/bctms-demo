/* eslint-disable @typescript-eslint/no-namespace */
import z4 from 'zod/v4';
import Issuance from './Issuances.zod';
import Billing from './Billing.zod';
import type User from './Users.zod';

export const PAYMENT_METHODS = [
	{ value: 'cash', label: 'Cash' },
	{ value: 'check', label: 'Check' },
	{ value: 'bank_transfer', label: 'Bank transfer' },
	{ value: 'gcash', label: 'GCash' },
	{ value: 'paymaya', label: 'PayMaya' },
	{ value: 'other', label: 'Other' }
] as const;

const paymentMethodValues = PAYMENT_METHODS.map((m) => m.value) as [string, ...string[]];

const PaymentMethodEnum = z4.enum(paymentMethodValues);

namespace Payment {
	//schemas
	export const Schema = z4.object({
		_id: z4.string().nonempty(),
		tracking_code: z4.string().nonempty(),
		issuance: z4
			.union([
				z4.string('Must be a valid issuance ID.').nonempty('Issuance is required.'),
				Issuance.Schema
			])
			.default(''),
		billing: z4
			.union([
				z4.string('Must be a valid billing ID.').nonempty('Billing is required.'),
				Billing.Schema
			])
			.default(''),
		amount: z4
			.number('Must be a valid payment amount.')
			.min(1, 'Payment must be 1 Php or more.')
			.nonnegative('Payment amount cannot be negative.'),
		payment_date: z4.coerce
			.date('Must be a valid payment date.')
			.min(new Date('2000-01-01'), 'Payment date cannot be earlier than 2000-01-01')
			.default(() => new Date())
			.refine((date) => date <= new Date(), { message: 'Payment date cannot be in the future.' }),
		payment_method: PaymentMethodEnum,
		payment_method_other: z4.string('Must be a valid payment method.').trim().optional(),
		reference_number: z4
			.string('Must be a valid payment reference number.')
			.nonempty('Payment reference number is required.'),
		notes: z4.string('Must be a valid payment note.')
	});

	export const CreateSchema = Schema.omit({ _id: true, issuance: true, billing: true })
		.extend({
			issuance: z4.string().nonempty('Issuance is required.'),
			billing: z4.string().nonempty('Billing is required.')
		})
		.superRefine((data, ctx) => {
			if (data.payment_method === 'other' && !data.payment_method_other) {
				ctx.addIssue({
					code: 'custom',
					message: 'Please specify other payment method.',
					path: ['payment_method_other']
				});
			}
			if (data.payment_method !== 'other' && data.payment_method_other) {
				ctx.addIssue({
					code: 'custom',
					message: "Other payment method should only be set when payment method is set to 'other'",
					path: ['payment_method']
				});
			}
		});

	export const EditSchema = Schema;

	export const ArchiveSchema = z4.object({
		_ids: z4.array(z4.string()).min(1, 'At least one item is required')
	});

	//types
	export type Create = z4.infer<typeof CreateSchema>;
	export type Edit = z4.infer<typeof EditSchema>;
	export type Archive = z4.infer<typeof ArchiveSchema>;
	export type Restore = z4.infer<typeof ArchiveSchema>;
	export type Base<
		Issuance = string | Issuance.Base,
		Billing = string | Billing.Base,
		CreatedBy = string | User.Base
	> = {
		_id: string;
		issuance: Issuance;
		billing: Billing;

		tracking_code: string;
		amount: number;
		payment_date: Date;
		payment_method: string;
		payment_method_other: string;
		reference_number: string;
		notes?: string;

		created_by: CreatedBy;
		created_at: Date;
		updated_at: Date;
	};
}

export default Payment;
