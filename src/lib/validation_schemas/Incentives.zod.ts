/* eslint-disable @typescript-eslint/no-namespace */
import { z } from 'zod/v4';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

namespace Incentive {
	export type RateType = 'percentage' | 'fixed';
	export type Basis = 'issued' | 'paid';

	export const RATE_TYPES: { value: RateType; label: string }[] = [
		{ value: 'percentage', label: 'Percentage' },
		{ value: 'fixed', label: 'Fixed per ticket' }
	];
	export const BASES: { value: Basis; label: string; hint: string }[] = [
		{ value: 'issued', label: 'Issued tickets', hint: 'Counted on the apprehension date' },
		{ value: 'paid', label: 'Paid tickets', hint: 'Counted on the date the bill was fully paid' }
	];

	/** One enforcement group's rate for a report. Values are only checked when `include` is on. */
	export const GroupSettingSchema = z
		.object({
			group: z.string().nonempty(),
			include: z.boolean().default(true),
			rate_type: z.enum(['percentage', 'fixed']).default('percentage'),
			amount: z.number('Enter an amount.').min(0).max(1_000_000, 'Amount is too large.').default(0),
			basis: z.enum(['issued', 'paid']).default('issued'),
			override_reason: z
				.string()
				.trim()
				.max(300, 'Keep the reason under 300 characters.')
				.default('')
		})
		.superRefine((d, ctx) => {
			if (!d.include) return;
			if (d.amount <= 0) {
				ctx.addIssue({
					code: 'custom',
					message: 'Enter an amount.',
					path: ['amount']
				});
			}
			if (d.rate_type === 'percentage' && d.amount > 100) {
				ctx.addIssue({
					code: 'custom',
					message: '100% at most.',
					path: ['amount']
				});
			}
		});

	export const ExclusionSchema = z.object({
		issuance: z.string().nonempty(),
		reason: z
			.string()
			.trim()
			.min(3, 'Say why this ticket is left out (at least 3 characters).')
			.max(300, 'Keep the reason under 300 characters.')
	});

	const GenerateFields = z.object({
		date_from: z.string().regex(DAY, 'Pick a start date.'),
		date_to: z.string().regex(DAY, 'Pick an end date.'),
		enforcement_group: z.array(z.string()).default([]),
		issuer: z.array(z.string()).default([]),
		user_type: z.array(z.string()).default([]),
		violation_category: z.array(z.string()).default([]),
		code_provision: z.array(z.string()).default([]),
		barangay: z.string().trim().max(100).default(''),
		exclude_legacy: z.boolean().default(false),
		settings: z.array(GroupSettingSchema).default([]),
		excluded: z.array(ExclusionSchema).default([]),
		remarks: z.string().trim().max(500, 'Keep the remarks under 500 characters.').default('')
	});

	const periodInOrder = <T extends { date_from: string; date_to: string }>(d: T) =>
		!DAY.test(d.date_from) || !DAY.test(d.date_to) || d.date_from <= d.date_to;
	const PERIOD_ORDER = {
		message: 'The end date must be on or after the start date.',
		path: ['date_to']
	};

	export const GenerateSchema = GenerateFields.refine(periodInOrder, PERIOD_ORDER);

	/**
	 * What a preview accepts: the same as generating, except a left-out ticket's reason may still
	 * be blank — previews refresh as the person works, and the reason is only owed at generation.
	 */
	export const PreviewSchema = GenerateFields.extend({
		excluded: z
			.array(z.object({ issuance: z.string().nonempty(), reason: z.string().default('') }))
			.default([])
	}).refine(periodInOrder, PERIOD_ORDER);

	export const VoidSchema = z.object({
		_id: z.string().nonempty(),
		reason: z
			.string()
			.trim()
			.min(5, 'Say why this report is being voided (at least 5 characters).')
			.max(500, 'Keep the reason under 500 characters.')
	});

	export type GroupSetting = z.infer<typeof GroupSettingSchema>;
	export type Generate = z.infer<typeof GenerateSchema>;
	export type PreviewInput = z.infer<typeof PreviewSchema>;
	export type Void = z.infer<typeof VoidSchema>;

	export type Rate = { rate_type: RateType; amount: number; basis: Basis };

	/** A ticket's line in a preview or saved report. */
	export type Line = {
		issuance: string;
		tracking_code: string;
		ticket_series: number;
		issuer: string;
		group: string;
		basis: Basis;
		event_date: string;
		base_amount: number;
		incentive_amount: number;
	};

	export type Totals = {
		ticket_count: number;
		base_amount: number;
		incentive_amount: number;
	};

	export type GroupSummary = Totals & { group: string; name: string; basis: Basis };

	export type RecipientSummary = Totals & {
		user: string;
		name: string;
		user_type: string;
		group: string;
	};

	export type GroupSettingSnapshot = {
		group: string;
		name: string;
		defaults: Rate | null;
		defaults_enabled: boolean;
		applied: Rate;
		overridden: boolean;
		override_reason: string;
	};

	/**
	 * Every ticket that qualifies, including any the person has ticked to leave out — the screen
	 * recomputes subtotals as tickets are excluded, with the same math the server saves with.
	 */
	export type Preview = {
		lines: Line[];
		people: Record<string, { name: string; user_type: string }>;
		groups: Record<string, { name: string; basis: Basis }>;
		group_settings: GroupSettingSnapshot[];
		/** Tickets that matched but were left out automatically, by reason. */
		skipped: {
			already_in_report: number;
			reissued: number;
			not_fully_paid: number;
			/** matched the filters but no enforcement group is recorded on the ticket */
			no_group: number;
		};
	};

	export type ReportStatus = 'pending' | 'generated' | 'voided';

	export type NamedRef = { _id: string; name: string };

	export type Report = {
		_id: string;
		reference_no: string;
		status: ReportStatus;
		period: { from: string; to: string };
		filters: {
			enforcement_groups: NamedRef[];
			issuers: NamedRef[];
			user_types: NamedRef[];
			violation_categories: NamedRef[];
			code_provisions: NamedRef[];
			barangay: string;
			exclude_legacy: boolean;
		};
		groups: string[];
		group_settings: GroupSettingSnapshot[];
		by_group: GroupSummary[];
		by_recipient: RecipientSummary[];
		totals: Totals & { recipient_count: number };
		exclusions: {
			issuance: string;
			tracking_code: string;
			issuer: string | null;
			group: string | null;
			reason: string;
		}[];
		remarks: string;
		generated_by: string;
		generated_by_name: string;
		voided_at: string | null;
		voided_by_name: string;
		void_reason: string;
		created_at: string;
	};
}

export default Incentive;
