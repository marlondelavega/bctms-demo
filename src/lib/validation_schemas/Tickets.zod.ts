/* eslint-disable @typescript-eslint/no-namespace */
import z from 'zod';
import type EnforcementGroup from './EnforcementGroups.zod';
import type User from './Users.zod';
import type TicketAssignment from './TicketAssignments.zod';
import type Issuance from './Issuances.zod';
import type Violator from './Violators.zod';
namespace Ticket {
	//schemas
	export const Schema = z.object({
		_id: z.string().nonempty(),
		name: z
			.string('Invalid name')
			.nonempty('Ticket name is required')
			.regex(/^[a-zA-Z0-9À-ÿ\s,.\-#_/]+$/, 'Ticket name contains invalid characters'),
		date_created: z.date('Invalid date').nonoptional('Date created is required'),
		date_withdrawn: z.date('Invalid date').optional(),
		ticket_num_from: z
			.number('Invalid ticket number')
			.nonnegative('Ticket number cannot be negative')
			.min(1, 'Ticket min series requires minimum of 1.')
			.nonoptional('Ticket number is required'),
		ticket_num_to: z
			.number('Invalid ticket number')
			.nonnegative('Ticket number cannot be negative')
			.nonoptional('Ticket number is required'),
		withdraw: z.boolean().default(false),
		ticket_for: z.string('Invalid group').optional(),
		in_charge: z.string('Invalid user').optional(),
		archived: z.boolean()
	});

	const withdrawAndSeriesRefinement = (data: Ticket.Create | Ticket.Edit, ctx: z.RefinementCtx) => {
		// series order check — always runs, regardless of withdraw

		if (!data.ticket_num_to || data.ticket_num_to <= 0) {
			ctx.addIssue({
				code: 'custom',
				message: 'Ticket series "to" is required and must be greater than "from".',
				path: ['ticket_num_to']
			});
		} else if (data.ticket_num_to <= data.ticket_num_from) {
			ctx.addIssue({
				code: 'custom',
				message: 'Ticket series "to" must be greater than "from".',
				path: ['ticket_num_to']
			});
		} else if (data.ticket_num_from > data.ticket_num_to) {
			ctx.addIssue({
				code: 'custom',
				message: 'Ticket series "from" must be less than "to".',
				path: ['ticket_num_from']
			});
		}

		// withdraw-specific required fields — only relevant when withdraw is true
		if (data.withdraw) {
			if (!data.ticket_for || data.ticket_for.length === 0) {
				ctx.addIssue({
					code: 'custom',
					message: 'Ticket for is required.',
					path: ['ticket_for']
				});
			}

			if (!data.in_charge || data.in_charge.length === 0) {
				ctx.addIssue({
					code: 'custom',
					message: 'Person in-charge is required.',
					path: ['in_charge']
				});
			}

			if (!data.date_withdrawn) {
				ctx.addIssue({
					code: 'custom',
					message: 'Date withdrawn is required.',
					path: ['date_withdrawn']
				});
			}
		}
	};

	export const CreateSchema = Schema.omit({ _id: true, archived: true }).superRefine(
		withdrawAndSeriesRefinement
	);
	export const EditSchema = Schema.omit({ archived: true }).superRefine(
		withdrawAndSeriesRefinement
	);
	export const ArchiveSchema = z.object({
		_ids: z.array(z.string()).min(1, 'At least one item is required')
	});
	export const WithdrawSchema = z.object({
		_ids: z.array(z.string()).nonempty(''),
		ticket_for: z.string('Invalid group').nonempty('Ticket for is required'),
		in_charge: z.string('Invalid user').nonempty('Person in-charge is required'),
		withdraw: z.boolean().default(false),
		date_withdrawn: z.coerce
			.date('Date is invalid')
			.min(new Date('2024-01-01'), { error: 'Date must be on or after Jan 1, 2024' })
			.nonoptional('Date withdrawn is required')
			.refine((date) => date <= new Date(Date.now() + 24 * 60 * 60 * 1000), {
				error: 'Date cannot be more than 1 day in the future'
			})
	});

	//types
	export type Create = z.infer<typeof CreateSchema>;
	export type Edit = z.infer<typeof EditSchema>;
	export type Withdraw = z.infer<typeof WithdrawSchema>;
	export type Archive = z.infer<typeof ArchiveSchema>;
	export type Restore = z.infer<typeof ArchiveSchema>;
	export type Base<
		E = string | EnforcementGroup.Base,
		U = string | User.Base,
		B = string | User.Base
	> = {
		_id: string;
		name: string;
		date_created: Date;
		date_withdrawn?: Date;
		ticket_num_from: number;
		ticket_num_to: number;
		ticket_for: E; //Enforcement group ref
		in_charge: U; //User ref
		created_by: B; //User ref
		archived: boolean;
	};

	export type SeriesRow = {
		series: number;
		assignment: TicketAssignment.Base<User.Base, Ticket.Base, User.Base>;
		issuance: Issuance.Base<TicketAssignment.Base, User.Base, Violator.Base>;
	};
}

export default Ticket;
