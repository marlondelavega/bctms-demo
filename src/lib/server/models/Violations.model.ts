import mongoose, { Schema } from 'mongoose';
import { dropStaleModel } from './define_model';

const ViolationSchema = new Schema(
	{
		issuance: { type: Schema.Types.ObjectId, required: true, ref: 'issuances' },
		ticket_assignment: { type: Schema.Types.ObjectId, required: true, ref: 'ticket_assignments' },
		ticket_series: { type: Number, required: true },
		issuer: { type: Schema.Types.ObjectId, required: true, ref: 'users' },
		recipient: { type: Schema.Types.ObjectId, required: true, ref: 'violators' },

		code_provision: { type: Schema.Types.ObjectId, required: true, ref: 'code_provisions' },
		code: { type: String, required: true, trim: true },
		description: { type: String, required: true },
		descriptor: { type: String, default: '' },
		level: { type: Number },
		penalty: {
			pecuniary: { type: Number, default: 0 },
			disciplinary: { type: String, default: '' }
		},
		violation_category: {
			name: { type: String, required: true },
			description: { type: String, required: true, trim: true }
		},
		violation_sub_category: {
			name: { type: String, required: true, trim: true }
		},
		enforcement_group: {
			name: { type: String, required: true, trim: true },
			description: { type: String, required: true, trim: true }
		},

		apprehension_barangay: { type: String, required: true },
		apprehension_address: { type: String, required: true },
		apprehension_date: { type: Date, required: true },
		apprehension_time: { type: Date, required: true }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'violations',
		versionKey: false
	}
);

dropStaleModel('violations');
const ViolationModel = mongoose.models.violations || mongoose.model('violations', ViolationSchema);

export default ViolationModel;
