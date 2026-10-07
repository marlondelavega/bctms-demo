import mongoose, { Schema } from 'mongoose';
import { dropStaleModel } from './define_model';

export const assignment_status = { ACTIVE: 0, INACTIVE: 1 };

const TicketAssignmentsSchema = new Schema(
	{
		ticket: { type: Schema.Types.ObjectId, required: true, ref: 'tickets' },
		user: { type: Schema.Types.ObjectId, required: true, ref: 'users' },
		assigned_by: { type: Schema.Types.ObjectId, required: true, ref: 'users' },
		series_from: { type: Schema.Types.Number, required: true },
		series_to: { type: Schema.Types.Number, required: true },
		status: {
			type: Schema.Types.Number,
			required: true,
			enum: Object.values(assignment_status),
			default: 0
		},
		date_assigned: { type: Schema.Types.Date, required: true, default: Date.now },
		archived: { type: Schema.Types.Boolean, required: true, default: false },
		legacy_staff_ticket_id: { type: Number, default: 0 }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'ticket_assignments',
		versionKey: false
	}
);

dropStaleModel('ticket_assignments');
const TicketAssignmentsModel =
	mongoose.models.ticket_assignments ||
	mongoose.model('ticket_assignments', TicketAssignmentsSchema);

export default TicketAssignmentsModel;
