import mongoose, { Schema } from 'mongoose';
import { dropStaleModel } from './define_model';
import './Users.model';
import './EnforcementGroups.model';

const TicketsSchema = new Schema(
	{
		name: { type: String, required: true, trim: true, unique: true },
		date_created: { type: Date, required: true },
		date_withdrawn: { type: Date, required: false },
		withdraw: { type: Boolean, required: false, default: false },
		ticket_num_from: { type: Number, required: true },
		ticket_num_to: { type: Number, required: true },
		ticket_for: { type: mongoose.Types.ObjectId, ref: 'enforcement_groups', required: false },
		in_charge: { type: mongoose.Types.ObjectId, ref: 'users', required: false },
		created_by: { type: Schema.Types.ObjectId, required: true, ref: 'users' },
		archived: { type: Boolean, default: false },
		legacy_ticket_id: { type: Number, default: 0 }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'tickets',
		versionKey: false
	}
);

dropStaleModel('tickets');
const TicketsModel = mongoose.models.tickets || mongoose.model('tickets', TicketsSchema);

export default TicketsModel;
