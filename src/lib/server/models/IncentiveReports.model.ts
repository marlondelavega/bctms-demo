import mongoose, { Schema } from 'mongoose';
import { dropStaleModel } from './define_model';
import { incentive_bases, incentive_rate_types } from './EnforcementGroups.model';
import './Users.model';
import './EnforcementGroups.model';

// 'pending' only exists while a report's lines are being written — a crash mid-write leaves a
// pending report behind, which the next generate cleans up (see cleanupStalePending)
export const incentive_report_status = ['pending', 'generated', 'voided'] as const;

const RateSchema = new Schema(
	{
		rate_type: { type: String, enum: incentive_rate_types, required: true },
		amount: { type: Number, required: true, min: 0 },
		basis: { type: String, enum: incentive_bases, required: true }
	},
	{ _id: false }
);

const NamedRefSchema = new Schema(
	{
		_id: { type: Schema.Types.ObjectId, required: true },
		name: { type: String, default: '' }
	},
	{ _id: false }
);

const GroupSettingSchema = new Schema(
	{
		group: { type: Schema.Types.ObjectId, ref: 'enforcement_groups', required: true },
		name: { type: String, required: true },
		// the group's saved settings at generation time (null when it had none)
		defaults: { type: RateSchema, default: null },
		defaults_enabled: { type: Boolean, default: false },
		applied: { type: RateSchema, required: true },
		overridden: { type: Boolean, required: true },
		override_reason: { type: String, default: '' }
	},
	{ _id: false }
);

const SummarySchema = new Schema(
	{
		ticket_count: { type: Number, required: true },
		base_amount: { type: Number, required: true },
		incentive_amount: { type: Number, required: true }
	},
	{ _id: false }
);

const GroupSummarySchema = SummarySchema.clone().add({
	group: { type: Schema.Types.ObjectId, ref: 'enforcement_groups', required: true },
	name: { type: String, required: true },
	basis: { type: String, enum: incentive_bases, required: true }
});

const RecipientSummarySchema = SummarySchema.clone().add({
	user: { type: Schema.Types.ObjectId, ref: 'users', required: true },
	name: { type: String, required: true },
	user_type: { type: String, default: '' },
	group: { type: Schema.Types.ObjectId, ref: 'enforcement_groups', required: true }
});

const ExclusionSchema = new Schema(
	{
		issuance: { type: Schema.Types.ObjectId, ref: 'issuances', required: true },
		tracking_code: { type: String, default: '' },
		issuer: { type: Schema.Types.ObjectId, ref: 'users', default: null },
		group: { type: Schema.Types.ObjectId, ref: 'enforcement_groups', default: null },
		reason: { type: String, required: true }
	},
	{ _id: false }
);

const IncentiveReportsSchema = new Schema(
	{
		reference_no: { type: String, required: true, unique: true },
		status: { type: String, enum: incentive_report_status, required: true, default: 'pending' },
		period: {
			from: { type: Date, required: true },
			to: { type: Date, required: true }
		},
		// a snapshot of what was filtered on, with names, so the report reads the same after a
		// group, user or user type is renamed or archived
		filters: {
			enforcement_groups: { type: [NamedRefSchema], default: [] },
			issuers: { type: [NamedRefSchema], default: [] },
			user_types: { type: [NamedRefSchema], default: [] },
			violation_categories: { type: [NamedRefSchema], default: [] },
			code_provisions: { type: [NamedRefSchema], default: [] },
			barangay: { type: String, default: '' },
			exclude_legacy: { type: Boolean, default: false }
		},
		// every group whose tickets are in this report — used for office-scope access
		groups: { type: [Schema.Types.ObjectId], ref: 'enforcement_groups', default: [] },
		group_settings: { type: [GroupSettingSchema], default: [] },
		by_group: { type: [GroupSummarySchema], default: [] },
		by_recipient: { type: [RecipientSummarySchema], default: [] },
		totals: {
			ticket_count: { type: Number, default: 0 },
			recipient_count: { type: Number, default: 0 },
			base_amount: { type: Number, default: 0 },
			incentive_amount: { type: Number, default: 0 }
		},
		exclusions: { type: [ExclusionSchema], default: [] },
		remarks: { type: String, default: '' },
		generated_by: { type: Schema.Types.ObjectId, ref: 'users', required: true },
		generated_by_name: { type: String, default: '' },
		voided_at: { type: Date, default: null },
		voided_by: { type: Schema.Types.ObjectId, ref: 'users', default: null },
		voided_by_name: { type: String, default: '' },
		void_reason: { type: String, default: '' }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'incentive_reports',
		versionKey: false
	}
);

IncentiveReportsSchema.index({ status: 1, created_at: -1 });
IncentiveReportsSchema.index({ groups: 1, created_at: -1 });

dropStaleModel('incentive_reports');
const IncentiveReportsModel =
	mongoose.models.incentive_reports || mongoose.model('incentive_reports', IncentiveReportsSchema);

export default IncentiveReportsModel;
