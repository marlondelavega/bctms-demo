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
		level: { type: Number },
		penalty: {
			pecuniary: { type: Number, default: 0 },
			disciplinary: { type: String, default: '' },
			surcharge: {
				type: { type: String, enum: ['fixed', 'percentage'], default: null },
				value: { type: Number, default: 0 },
				applied_after_days: { type: Number, default: 0 },
				applied_every_after: { type: Number, default: 0 },
				surcharge_due_date: { type: Date },
				surcharge_applied_date: { type: Date, default: null },
				surcharge_amount: { type: Number, default: 0 }
			}
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
		}
	},
	{ _id: true }
);

const BillingSchema = new Schema(
	{
		issuance: { type: Schema.Types.ObjectId, ref: 'issuances', required: true },

		recipient: { type: Schema.Types.ObjectId, ref: 'violators', required: false },

		violations: {
			type: [ViolationSnapshotSchema],
			validate: {
				validator: (v: unknown[]) => v.length > 0,
				message: 'At least one violation is required.'
			}
		},

		violations_total_amount: { type: Number, required: true },

		payment_status: {
			type: String,
			enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
			default: 'UNPAID'
		},
		amount_paid: { type: Number, default: 0 },
		balance: {
			type: Number,
			required: true,
			default: function () {
				return this.violations_total_amount;
			}
		},

		cancelled: { type: Boolean, required: true, default: false },
		cancelled_date: { type: Date, default: null },
		cancellation_reason: { type: String, default: '' },
		legacy_ticket_issue_id: { type: Number, default: 0 }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'billings',
		versionKey: false
	}
);

BillingSchema.index({ issuance: 1 });

dropStaleModel('billings');
const BillingModel = mongoose.models.billings || mongoose.model('billings', BillingSchema);

export default BillingModel;
