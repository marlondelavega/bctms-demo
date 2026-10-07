import mongoose, { Schema } from 'mongoose';
import { dropStaleModel } from './define_model';

const ViolationSnapshotSchema = new Schema(
	{
		//reference
		code_provision: { type: Schema.Types.ObjectId, required: true, ref: 'code_provisions' },

		//snapshot
		code: { type: String, required: true, trim: true },
		description: { type: String, required: true },
		descriptor: { type: String, default: '' },
		level: { type: Number, default: 1, min: 1 },
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
		damaged: { type: Boolean, default: false }
	},
	{ _id: true }
);

const IssuanceSchema = new Schema(
	{
		ticket_assignment: { type: Schema.Types.ObjectId, required: true, ref: 'ticket_assignments' },
		ticket_series: { type: Number, required: true },
		issuer: { type: Schema.Types.ObjectId, required: true, ref: 'users' },
		// the issuer's group when the ticket was issued (backfilled for older tickets) — incentives are
		// grouped by this, so an officer who transfers keeps their old tickets under the old group
		enforcement_group: { type: Schema.Types.ObjectId, ref: 'enforcement_groups', default: null },
		recipient: { type: Schema.Types.ObjectId, required: true, ref: 'violators' },
		status: {
			type: Number,
			required: true
		},
		violations: {
			type: [ViolationSnapshotSchema],
			validate: {
				validator: (v: unknown[]) => v.length > 0,
				message: 'At least one violation is required'
			}
		},
		remarks: { type: String },
		apprehension_barangay: { type: String, required: true },
		apprehension_address: { type: String, required: true },
		apprehension_date: { type: Date, required: true },
		apprehension_time: { type: Date, required: true },
		reissued_from: {
			type: mongoose.Schema.Types.ObjectId,
			required: false,
			ref: 'issuances',
			default: null
		},
		tracking_code: { type: String, required: true, unique: true },
		legacy_ticket_issue_id: { type: Number, default: 0 }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'issuances',
		versionKey: false
	}
);

// named so it doesn't collide with the unique index `tracking_code: { unique: true }` creates
IssuanceSchema.index(
	{ tracking_code: 1 },
	{ name: 'tracking_code_ci', collation: { locale: 'en', strength: 2 } }
);

IssuanceSchema.index({ issuer: 1, _id: -1 });

IssuanceSchema.index({ enforcement_group: 1, apprehension_date: 1 });

IssuanceSchema.index({ reissued_from: 1 });

dropStaleModel('issuances');
const IssuanceModel = mongoose.models.issuances || mongoose.model('issuances', IssuanceSchema);

export default IssuanceModel;
