import mongoose, { Schema } from 'mongoose';
import { dropStaleModel } from './define_model';
import './ViolationCategories.model';
import './EnforcementGroups.model';
import './Users.model';

const CodeProvisionsSchema = new Schema(
	{
		code: { type: String, required: true, trim: true, unique: true },
		description: { type: String, required: true },
		descriptor: { type: String, required: true, default: '' },
		created_by: { type: Schema.Types.ObjectId, required: true, ref: 'users' },
		penalty: {
			type: [Object],
			required: true,
			pecuniary: { type: Number, required: false, default: 0 },
			disciplinary: { type: String, required: false, default: '' }
		},
		violation_category: {
			type: mongoose.Types.ObjectId,
			ref: 'violation_categories',
			required: true
		},
		violation_sub_category: { type: mongoose.Types.ObjectId, required: true },
		enforcement_group: { type: mongoose.Types.ObjectId, required: true, ref: 'enforcement_groups' },
		archived: { type: Boolean, default: false },
		legacy_violation_id: { type: Number, default: 0 }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'code_provisions',
		versionKey: false
	}
);

export type Surcharge = {
	type: 'fixed' | 'percentage';
	value: number;
	applied_after_days: number;
	applied_every_after: number;
};

export type BillingSurcharge = Surcharge & {
	surcharge_due_date: Date;
	surcharge_applied_date: Date | null;
	surcharge_amount: number;
};

export type Penalty<_Surcharge = Surcharge | BillingSurcharge> = {
	pecuniary?: number;
	disciplinary?: string;
	surcharge?: _Surcharge;
};

dropStaleModel('code_provisions');
const CodeProvisionsModel =
	mongoose.models.code_provisions || mongoose.model('code_provisions', CodeProvisionsSchema);

export default CodeProvisionsModel;
