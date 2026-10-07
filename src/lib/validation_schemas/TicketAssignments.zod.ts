/* eslint-disable @typescript-eslint/no-namespace */
import z from 'zod';
import type User from './Users.zod';
import type Ticket from './Tickets.zod';

namespace TicketAssignment {
	//schemas
	export const Schema = z.object({
		_id: z.string().nonempty(),
		ticket: z.string().nonempty('Ticket is required.'),
		user: z.string().nonempty('User is required to assign this ticket.'),
		series_from: z.number().nonnegative('Series number cannot be negative.'),
		series_to: z.number().nonnegative('Series numbercannot be negative.'),
		status: z
			.number()
			.nonnegative('Status cannot be negative')
			.max(20, 'Invalid status.')
			.default(0),
		date_assigned: z.coerce
			.date('Must be a date.')
			.min(new Date('2020-01-01'), { message: 'Date must be after Jan 1, 2020' })
			// evaluated per parse; a static `.max(new Date())` would freeze at server start
			.refine((d) => d <= new Date(), { message: 'Date cannot be in the future' }),
		archived: z.boolean('')
	});

	export const List = z.array(Schema);
	export const CreateSchema = Schema.omit({ _id: true, archived: true });
	export const EditSchema = Schema.omit({ archived: true });
	export const ArchiveSchema = z.object({
		_ids: z.array(z.string())
	});

	//types
	export type Create = z.infer<typeof CreateSchema>;
	export type Edit = z.infer<typeof EditSchema>;
	export type Archive = z.infer<typeof ArchiveSchema>;
	export type Restore = z.infer<typeof ArchiveSchema>;
	export type Base<U = string | User.Base, T = string | Ticket.Base, A = string | User.Base> = {
		_id: string;
		user: U;
		ticket: T;
		assigned_by: A;
		series_from: number;
		series_to: number;
		status: number;
		date_assigned: Date;
		archived: boolean;
	};
}

export default TicketAssignment;
