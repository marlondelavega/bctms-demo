import mongoose, { Schema } from 'mongoose';
import { dropStaleModel } from './define_model';

const ViolationSubCategorySchema = new Schema({
	name: { type: String, required: true, trim: true }
});

const ViolationCategorySchema = new Schema(
	{
		name: { type: String, required: true, trim: true, unique: true },
		description: { type: String, required: true, trim: true },
		sub_categories: [ViolationSubCategorySchema],
		archived: { type: Boolean, default: false },
		created_by: { type: Schema.Types.ObjectId, required: true, ref: 'users' }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'violation_categories',
		versionKey: false
	}
);

dropStaleModel('violation_categories');
const ViolationCategoryModel =
	mongoose.models.violation_categories ||
	mongoose.model('violation_categories', ViolationCategorySchema);

export default ViolationCategoryModel;
