import z from 'zod/v4';
import type CodeProvision from './CodeProvisions.zod';
import type Issuance from './Issuances.zod';
import type TicketAssignment from './TicketAssignments.zod';
import type User from './Users.zod';
import type Violator from './Violators.zod';

/* eslint-disable @typescript-eslint/no-namespace */
namespace Violation {
	export const Schema = z.object({
		// snapshots may carry an ObjectId here, so stringify — but let null/undefined fail instead of becoming "null"/"undefined"
		code_provision: z.preprocess(
			(v) => (v == null ? v : String(v)),
			z.string('Code provision is required.').nonempty('Code provision is required.')
		),

		code: z.string(),
		description: z.string(),
		descriptor: z.string(),
		level: z.number().optional(),
		penalty: z.object({
			pecuniary: z.number(),
			disciplinary: z.string()
		}),
		violation_category: z.object({
			name: z.string(),
			description: z.string()
		}),
		violation_sub_category: z.object({ name: z.string() }),
		enforcement_group: z.object({
			name: z.string(),
			description: z.string()
		})
	});

	export const List = Schema.array();

	export type Base<
		_Issuance = string | Issuance.Base,
		_TicketAssignment = string | TicketAssignment.Base,
		_Issuer = string | User.Base,
		_Recipient = string | Violator.Base,
		_CodeProvision = string | CodeProvision.Base
	> = {
		issuance: _Issuance;
		ticket_assignment: _TicketAssignment;
		ticket_series: number;
		issuer: _Issuer;
		recipient: _Recipient;
		code_provision: _CodeProvision;

		code: string;
		description: string;
		descriptor: string;
		penalty: string;
		violation_category: string;
		violation_sub_category: string;
		enforcement_group: string;

		apprehension_barangay: string;
		apprehension_address: string;
		apprehension_date: string;
		apprehension_time: string;
	};

	export type Snapshot<_CodeProvision = string | CodeProvision.Base> = {
		code_provision: _CodeProvision;

		code: string;
		description: string;
		descriptor: string;
		level: number;
		penalty: {
			pecuniary: number;
			disciplinary: string;
		};
		violation_category: {
			name: string;
			description: string;
		};
		violation_sub_category: {
			name: string;
		};
		enforcement_group: {
			name: string;
			description: string;
		};
	};

	export type BillingSnapshot<_CodeProvision = string | CodeProvision.Base> = {
		code_provision: _CodeProvision;

		code: string;
		description: string;
		descriptor: string;
		level: number;
		penalty: {
			pecuniary: number;
			disciplinary: string;
			surcharge: {
				type: 'fixed' | 'percentage' | null;
				value: number;
				applied_after_days: number;
				applied_every_after: number;
				surcharge_due_date: Date | null;
				surcharge_applied_date: Date | null;
				surcharge_amount: number;
			};
		};
		violation_category: {
			name: string;
			description: string;
		};
		violation_sub_category: {
			name: string;
		};
		enforcement_group: {
			name: string;
			description: string;
		};
	};
}

export default Violation;
