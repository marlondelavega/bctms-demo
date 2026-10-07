import mongoose, { Schema } from 'mongoose';
import { dropStaleModel } from './define_model';

export const log_levels = { INFO: 'INFO', NOTICE: 'NOTICE', ERROR: 'ERROR' } as const;

export const log_types = {
	CREATE: 'CREATE',
	EDIT: 'EDIT',
	ARCHIVE: 'ARCHIVE',
	RESTORE: 'RESTORE',
	REQUEST: 'REQUEST',
	LOGIN: 'LOGIN'
} as const;

// nested field defs need their own Schema — an object literal with a sibling `type` key is read by
// mongoose as SchemaType options for a single field (type: Object), not as a sub-schema, so any
// keys declared alongside `type` (required, enum, ...) are silently ignored rather than enforced.
const AffectedCollectionSchema = new Schema(
	{
		collection_name: { type: String, required: true },
		document_id: { type: [String], required: true }
	},
	{ _id: false }
);

const LogUserSchema = new Schema(
	{
		// not `required` — mongoose rejects '' for required strings, and an actor-less entry is still worth keeping
		user_id: { type: String, default: '' },
		// a trimmed snapshot for display, not the full user document — avoids duplicating
		// sensitive/bulky user fields (e.g. password hash) into every log row.
		user_data: {
			type: new Schema(
				{
					name: { type: String, required: false },
					username: { type: String, required: false },
					user_type: { type: String, required: false }
				},
				{ _id: false }
			),
			required: false
		}
	},
	{ _id: false }
);

const LogsSchema = new Schema(
	{
		level: { type: String, required: true, enum: Object.values(log_levels) },
		type: { type: String, required: true, enum: Object.values(log_types) },
		message: { type: String, required: false },
		source: { type: String, required: true },
		metadata: { type: mongoose.Schema.Types.Mixed, required: false },
		affected_collection: { type: AffectedCollectionSchema, required: false },
		user: { type: LogUserSchema, required: true }
	},
	{
		timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
		collection: 'logs',
		versionKey: false
	}
);

LogsSchema.index({ created_at: -1 });
LogsSchema.index({ type: 1 });
LogsSchema.index({ level: 1 });
LogsSchema.index({ 'user.user_id': 1 });
LogsSchema.index({ 'affected_collection.collection_name': 1 });

export type T_Log_C = {
	level: keyof typeof log_levels;
	type: keyof typeof log_types;
	message: string;
	source: string;
	metadata?: unknown;
	affected_collection?: {
		collection_name: string;
		document_id: string[];
	};
	user: {
		user_id: string;
		user_data?: {
			name?: string;
			username?: string;
			user_type?: string;
		};
	};
};

dropStaleModel('logs');
const LogsModel = mongoose.models.logs || mongoose.model('logs', LogsSchema);

export default LogsModel;
