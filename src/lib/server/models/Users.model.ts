import mongoose, { Schema } from 'mongoose';
import { dropStaleModel } from './define_model';
import './UserTypes.model';
import './EnforcementGroups.model';

export const UsersSchema = new Schema(
	{
		profile_image: { type: String, required: false, trim: true, default: '' },
		enforcement_group: { type: Schema.Types.ObjectId, ref: 'enforcement_groups', required: true },
		user_type: { type: Schema.Types.ObjectId, ref: 'user_types', required: true },
		username: { type: String, required: true, trim: true, unique: true },
		firstname: { type: String, required: true, trim: true },
		middlename: { type: String, required: false, trim: true, default: '' },
		lastname: { type: String, required: true, trim: true },
		password: { type: String, required: true, select: false },
		archived: { type: Boolean, default: false },
		password_change: { type: Boolean, default: true },
		last_password_change_date: { type: Date, default: Date.now, required: true },
		created_by: { type: Schema.Types.ObjectId, required: false, ref: 'users', default: null },
		legacy_user_id: { type: Number, default: 0, required: true },
		legacy_user_type_ref: { type: Number, default: 0 },
		legacy_fullname: { type: String, default: '' }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'users',
		versionKey: false
	}
);

dropStaleModel('users');
const UsersModel = mongoose.models.users || mongoose.model('users', UsersSchema);

export default UsersModel;
