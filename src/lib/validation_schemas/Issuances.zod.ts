import z from 'zod';
import type User from './Users.zod';
import type Violator from './Violators.zod';
import type Violation from './Violations.zod';
import type TicketAssignment from './TicketAssignments.zod';

export enum issuance_status {
	ISSUED = 1,
	'NOTICE OF SETTLEMENT' = 2,
	PAID = 3,
	'FILED CASE' = 4,
	'CASE CLOSED' = 5,
	CANCELLED = 6
}

/* eslint-disable @typescript-eslint/no-namespace */
namespace Issuance {
	export const ViolationSnapshot = z.object({
		code_provision: z.string(),
		code: z.string(),
		description: z.string(),
		descriptor: z.string(),
		level: z.number().optional(),
		penalty: z.object({
			pecuniary: z.number(),
			disciplinary: z.string()
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

	const ADDRESS_SAFE_REGEX = /^[\p{L}\p{N}\s.,\-/#'&()]+$/u;

	const addressField = (label: string) =>
		z
			.string(`Must be a valid ${label}`)
			.trim()
			.nonempty(`${label} is required`)
			.max(200, `${label} must be under 200 characters`)
			.regex(ADDRESS_SAFE_REGEX, `${label} contains invalid characters`);

	export const Schema = z.object({
		_id: z.string().nonempty(),
		// ticket details
		ticket_assignment: z
			.string('Must be a valid ticket assignment')
			.nonempty('Ticket assignment is required'),
		ticket_series: z
			.number('Must be a valid series')
			.nonnegative('Series must be a non-negative number')
			.int('Series must be an integer')
			.min(0, 'Series is required'),
		issuer: z.string(),
		recipient: z.string('Must be a valid recipient').nonempty('Recipient is required'),
		status: z.enum(issuance_status).default(issuance_status.ISSUED),
		remarks: z.string('Must be a valid remarks'),
		violations: z
			.array(z.union([ViolationSnapshot, z.string()]))
			.min(1, 'At least one violation is required'),

		// apprehension details
		apprehension_barangay: addressField('Barangay'),
		apprehension_address: addressField('Address'),
		apprehension_date: z.coerce
			.date('Must be a valid date')
			.nonoptional('Apprehension date is required'),
		apprehension_time: z.date('Must be a valid time').nonoptional('Apprehension time is required'),
		reissued_from: z.string().optional(),
		tracking_code: z.string()
	});

	export const CreateSchema = Schema.omit({ _id: true }).extend({
		violations: z.array(z.string())
	});
	export const EditSchema = CreateSchema.extend({ _id: z.string().nonempty() });
	export const ArchiveSchema = z.object({
		_ids: z.array(z.string()).min(1, 'At least one item is required')
	});
	export const RestoreSchema = ArchiveSchema;

	export const ChangeStatusSchema = z
		.object({
			status: z.union([z.enum(issuance_status), z.literal(0)]).default(0),
			remarks: z.string('Remarks must be a string.'),
			issuance_id: z.string().nonempty('Issuance ID is required.')
		})
		.superRefine((data, ctx) => {
			if (data.status == 0) {
				ctx.addIssue({
					code: 'custom',
					message: 'Status is required.',
					path: ['status']
				});
			}
			if (data.status == 6 && data.remarks == '') {
				ctx.addIssue({
					code: 'custom',
					message: 'Remarks is required when changing status to cancelled.',
					path: ['remarks']
				});
			}
		});
	export type ChangeStatus = z.input<typeof ChangeStatusSchema>;

	export type Create = z.infer<typeof CreateSchema>;
	export type Edit = z.infer<typeof EditSchema>;
	export type Archive = z.infer<typeof ArchiveSchema>;
	export type Restore = z.infer<typeof RestoreSchema>;
	export type Base<
		T = string | TicketAssignment.Base,
		U = string | User.Base,
		V = string | Violator.Base
	> = {
		_id: string;
		ticket_assignment: T;
		ticket_series: number;
		issuer: U;
		recipient: V;
		status: issuance_status;
		remarks: string;
		violations: Violation.Snapshot[];
		apprehension_barangay: string;
		apprehension_address: string;
		apprehension_date: Date;
		apprehension_time: string;
		archived: boolean;
		reissued_from: string | null;
		tracking_code: string;
	};
}

export default Issuance;
