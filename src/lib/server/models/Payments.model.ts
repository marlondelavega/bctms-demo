import mongoose from 'mongoose';
import { dropStaleModel } from './define_model';

const PaymentSchema = new mongoose.Schema(
	{
		issuance: { type: mongoose.Schema.Types.ObjectId, ref: 'issuances', required: true },
		billing: { type: mongoose.Schema.Types.ObjectId, ref: 'billings', required: true },
		tracking_code: { type: String, required: true, trim: true },
		amount: { type: Number, required: true, min: 1 },
		payment_date: { type: Date, required: true, default: Date.now },
		payment_method: { type: String, required: true, trim: true },
		payment_method_other: { type: String, trim: true },
		reference_number: { type: String, required: true, trim: true },
		notes: { type: String },
		created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
		legacy_ticket_issue_id: { type: Number, default: 0 }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'payments',
		versionKey: false
	}
);

PaymentSchema.index({ created_by: 1, _id: -1 });
PaymentSchema.index({ issuance: 1 });
PaymentSchema.index({ payment_date: 1 });

dropStaleModel('payments');
const PaymentModel = mongoose.models.payments || mongoose.model('payments', PaymentSchema);

export default PaymentModel;
