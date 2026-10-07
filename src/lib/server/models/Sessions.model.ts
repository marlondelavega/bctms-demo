import mongoose, { Schema } from 'mongoose';
import { dropStaleModel } from './define_model';
import './Users.model';

export const session_revoke_reasons = {
	LOGOUT: 'logout',
	ADMIN_REVOKED: 'admin_revoked',
	PASSWORD_CHANGED: 'password_changed',
	PASSWORD_RESET: 'password_reset',
	USER_ARCHIVED: 'user_archived',
	SESSION_LIMIT: 'session_limit',
	EXPIRED: 'expired'
} as const;

export type T_SessionRevokeReason =
	(typeof session_revoke_reasons)[keyof typeof session_revoke_reasons];

const DeviceSchema = new Schema(
	{
		browser: { type: String, default: 'Unknown' },
		os: { type: String, default: 'Unknown' },
		kind: { type: String, enum: ['desktop', 'mobile', 'tablet'], default: 'desktop' }
	},
	{ _id: false }
);

export const SessionsSchema = new Schema(
	{
		user: { type: Schema.Types.ObjectId, ref: 'users', required: true },
		// pushed forward on activity (sliding idle timeout), never past absolute_expires_at
		idle_expires_at: { type: Date, required: true },
		absolute_expires_at: { type: Date, required: true },
		last_seen_at: { type: Date, required: true },
		revoked_at: { type: Date, default: null },
		revoked_by: { type: Schema.Types.ObjectId, ref: 'users', default: null },
		revoked_reason: {
			type: String,
			enum: Object.values(session_revoke_reasons),
			default: null
		},
		// best-effort only: the app runs behind a reverse proxy, so this is unverified
		ip: { type: String, default: '' },
		user_agent: { type: String, default: '' },
		device: { type: DeviceSchema, default: () => ({}) },
		// TTL: expired/revoked sessions stay visible for the audit window, then Mongo removes them
		purge_at: { type: Date, required: true }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'sessions',
		versionKey: false
	}
);

SessionsSchema.index({ user: 1, revoked_at: 1, idle_expires_at: 1 });
SessionsSchema.index({ purge_at: 1 }, { expireAfterSeconds: 0 });

dropStaleModel('sessions');
const SessionsModel = mongoose.models.sessions || mongoose.model('sessions', SessionsSchema);

export default SessionsModel;
