import mongoose, { Schema } from 'mongoose';
import { dropStaleModel } from './define_model';

export type permission_action = 'access' | 'create' | 'edit' | 'archive' | 'restore';
export type permission_scope = 'all' | 'office' | 'own' | 'none';
export type permission_resource =
	| 'users'
	| 'tickets'
	| 'violators'
	| 'user_types'
	| 'enforcement_groups'
	| 'violation_categories'
	| 'code_provisions'
	| 'issuance'
	| 'ticket_assignments'
	| 'ticket_liquidation'
	| 'billing'
	| 'payments'
	| 'reports'
	| 'logs'
	| 'incentives';

export const actions: permission_action[] = ['access', 'create', 'edit', 'archive', 'restore'];
export const scopes: permission_scope[] = ['all', 'office', 'own', 'none'];
export const resources: permission_resource[] = [
	'users',
	'tickets',
	'violators',
	'user_types',
	'enforcement_groups',
	'violation_categories',
	'code_provisions',
	'issuance',
	'ticket_assignments',
	'ticket_liquidation',
	'billing',
	'payments',
	'reports',
	'logs',
	'incentives'
];

export const dev_permissions = actions.flatMap((action) =>
	resources.map((resource) => `${action}:all:${resource}` as const)
);

const UserTypesSchema = new Schema(
	{
		user_type: { type: String, required: true, trim: true, unique: true },
		role: { type: String, required: true, trim: true },
		permissions: {
			type: [String],
			required: false,
			validate: {
				validator: (values: string[]) =>
					values.every((v) => {
						const [action, scope, resource] = v.split(':');
						return (
							(actions as string[]).includes(action) &&
							(scopes as string[]).includes(scope) &&
							(resources as string[]).includes(resource)
						);
					}),
				message: 'Permission strings must be of the form "action:scope:resource" with known values.'
			}
		},
		access_level: { type: Number, required: true, default: 5 },
		archived: { type: Boolean, default: false },
		created_by: { type: Schema.Types.ObjectId, required: false, ref: 'users', default: null }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'user_types',
		versionKey: false
	}
);

dropStaleModel('user_types');
const UserTypesModel = mongoose.models.user_types || mongoose.model('user_types', UserTypesSchema);

export default UserTypesModel;
