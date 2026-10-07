import mongoose from 'mongoose';
import { dropStaleModel } from './define_model';

const TicketTrackingSchema = new mongoose.Schema(
	{
		issuance: { type: mongoose.Types.ObjectId, required: true, ref: 'issuances' },
		status: { type: Number, required: true },
		label: { type: String, required: true },
		remarks: { type: String, required: false },
		// unset for entries written by the automated overdue scan — no human actor to attribute them to
		changed_by: { type: mongoose.Types.ObjectId, required: false, ref: 'users' },
		// set only on entries imported from the legacy system (negative = written to fill a gap in its log)
		legacy_log_id: { type: Number, required: false }
	},
	{
		timestamps: { createdAt: 'created_at' },
		collection: 'tickets_tracking',
		versionKey: false
	}
);

dropStaleModel('tickets_tracking');
const TicketTrackingModel =
	mongoose.models.tickets_tracking || mongoose.model('tickets_tracking', TicketTrackingSchema);

export default TicketTrackingModel;
