import mongoose, { Schema } from 'mongoose';
import { dropStaleModel } from './define_model';
import { incentive_bases } from './EnforcementGroups.model';

// one row per ticket counted in a report; kept out of the report document so a large report
// can't hit the 16MB document limit, and so the unique index below can guard double-counting
export const incentive_item_status = ['active', 'voided'] as const;

const IncentiveReportItemsSchema = new Schema(
	{
		report: { type: Schema.Types.ObjectId, ref: 'incentive_reports', required: true },
		issuance: { type: Schema.Types.ObjectId, ref: 'issuances', required: true },
		tracking_code: { type: String, required: true },
		ticket_series: { type: Number, default: 0 },
		issuer: { type: Schema.Types.ObjectId, ref: 'users', required: true },
		group: { type: Schema.Types.ObjectId, ref: 'enforcement_groups', required: true },
		basis: { type: String, enum: incentive_bases, required: true },
		// apprehension date for 'issued', date of the settling payment for 'paid'
		event_date: { type: Date, required: true },
		base_amount: { type: Number, required: true },
		incentive_amount: { type: Number, required: true },
		status: { type: String, enum: incentive_item_status, required: true, default: 'active' }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: false },
		collection: 'incentive_report_items',
		versionKey: false
	}
);

// a ticket can be in only one live report, whatever its basis — this is what stops two people
// generating overlapping reports at the same moment from paying the same ticket twice
IncentiveReportItemsSchema.index(
	{ issuance: 1 },
	{ unique: true, partialFilterExpression: { status: 'active' } }
);
IncentiveReportItemsSchema.index({ report: 1, group: 1, issuer: 1 });
IncentiveReportItemsSchema.index({ issuer: 1, status: 1 });

dropStaleModel('incentive_report_items');
const IncentiveReportItemsModel =
	mongoose.models.incentive_report_items ||
	mongoose.model('incentive_report_items', IncentiveReportItemsSchema);

export default IncentiveReportItemsModel;
