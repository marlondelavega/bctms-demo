import z from 'zod/v4';
import Issuance, { issuance_status } from './Issuances.zod';
import type User from './Users.zod';

/* eslint-disable @typescript-eslint/no-namespace */
namespace TicketTracking {
	export const Schema = z.object({
		_id: z.string().nonempty(),
		issuance: z.string('Must be a valid issuance.').nonempty('Issuance is required for tracking.'),
		status: z.enum(issuance_status).default(issuance_status.ISSUED),
		label: z.string('Must be a valid label.').nonempty('Label is required for tracking.'),
		remarks: z.string('Must be a valid remarks.')
	});

	export const CreateSchema = Schema.omit({ _id: true });

	export type Create = z.infer<typeof CreateSchema>;
	export type Base<_Issuance = string | Issuance.Base, _User = string | User.Base> = {
		_id: string;
		issuance: _Issuance;
		status: issuance_status;
		label: string;
		remarks: string;
		// null for entries the automated overdue scan writes — there's no staff member to attribute those to
		changed_by: _User | null;
		created_at: Date;
	};
}

export default TicketTracking;
