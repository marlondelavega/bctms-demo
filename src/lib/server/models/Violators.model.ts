import mongoose, { Schema } from 'mongoose';
import { dropStaleModel } from './define_model';

const ViolatorsSchema = new Schema(
	{
		profile_image: { type: String, required: false, trim: true, default: '' },
		firstname: { type: String, required: false, trim: true },
		middlename: { type: String, required: false, trim: true },
		lastname: { type: String, required: true, trim: true },
		suffix: { type: String, required: false, trim: true },
		sex: { type: String, required: false, enum: ['male', 'female'], default: null },
		birthdate: { type: Date, required: false, default: null },
		license_number: { type: String, required: false },
		contact_number: { type: String, required: false },
		address_province: { type: String, required: false, trim: true, default: '' },
		address_city: { type: String, required: false, trim: true },
		address_barangay: { type: String, required: false, trim: true },
		address_line: { type: String, required: false, trim: true },
		address_house_number: { type: Number, required: false, trim: true },
		archived: { type: Boolean, default: false },
		created_by: { type: Schema.Types.ObjectId, required: true, ref: 'users' },
		legacy_violator_id: { type: Number, default: 0 },
		legacy_profile_image: { type: String, required: false, default: '' }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'violators',
		versionKey: false
	}
);

ViolatorsSchema.index(
	{ license_number: 1 },
	// `$ne` is not allowed in a partial index filter, so "non-empty" is written as `$gt: ''`
	{ unique: true, partialFilterExpression: { license_number: { $gt: '' } } }
);
ViolatorsSchema.index({ firstname: 1, lastname: 1 });
ViolatorsSchema.index({ archived: 1, lastname: 1 });
ViolatorsSchema.index({ created_by: 1 });

dropStaleModel('violators');
const ViolatorsModel = mongoose.models.violators || mongoose.model('violators', ViolatorsSchema);

export default ViolatorsModel;
