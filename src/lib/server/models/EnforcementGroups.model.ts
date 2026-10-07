import mongoose, { Schema } from 'mongoose';
import { dropStaleModel } from './define_model';

export const incentive_rate_types = ['percentage', 'fixed'] as const;
export const incentive_bases = ['issued', 'paid'] as const;

// the group's defaults for generating incentive reports — the generate form starts from these,
// and every report snapshots what they were at the time, so editing them never rewrites history
const IncentiveSettingsSchema = new Schema(
	{
		enabled: { type: Boolean, default: false },
		// 'percentage' of the ticket's base amount, or a 'fixed' amount per ticket
		rate_type: { type: String, enum: incentive_rate_types, required: true },
		amount: { type: Number, required: true, min: 0 },
		// 'issued': counted on the apprehension date, base = fine total
		// 'paid': counted on the date the billing was fully settled, base = amount paid
		basis: { type: String, enum: incentive_bases, required: true },
		updated_by: { type: Schema.Types.ObjectId, ref: 'users', default: null },
		updated_at: { type: Date, default: Date.now }
	},
	{ _id: false }
);

const EnforcementGroupSchema = new Schema(
	{
		name: { type: String, required: true, trim: true, unique: true },
		description: { type: String, required: true, trim: true },
		archived: { type: Boolean, default: false },
		created_by: { type: Schema.Types.ObjectId, required: false, ref: 'users', default: null },
		incentive: { type: IncentiveSettingsSchema, default: null },
		legacy_user_type_id: { type: Number, required: false, default: 0 }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'enforcement_groups',
		versionKey: false
	}
);

dropStaleModel('enforcement_groups');
const EnforcementGroupsModel =
	mongoose.models.enforcement_groups ||
	mongoose.model('enforcement_groups', EnforcementGroupSchema);

export default EnforcementGroupsModel;
