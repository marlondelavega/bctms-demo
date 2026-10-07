import SessionsModel, {
	session_revoke_reasons,
	type T_SessionRevokeReason
} from '../models/Sessions.model';

export const MAX_SESSIONS_PER_USER = 3;
export const SESSION_IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
// must stay well under the idle timeout, or an active user could be idled out between writes
const SESSION_TOUCH_THROTTLE_MS = 5 * 60 * 1000;
const SESSION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type T_ActiveSession = {
	_id: string;
	user: string;
	last_seen_at: Date;
	absolute_expires_at: Date;
};

export function parseUserAgent(ua: string) {
	const kind = /iPad|Tablet/i.test(ua)
		? 'tablet'
		: /Mobi|Android|iPhone/i.test(ua)
			? 'mobile'
			: 'desktop';

	const browser = /Edg\//.test(ua)
		? 'Edge'
		: /OPR\/|Opera/.test(ua)
			? 'Opera'
			: /Firefox\//.test(ua)
				? 'Firefox'
				: /Chrome\//.test(ua)
					? 'Chrome'
					: /Safari\//.test(ua)
						? 'Safari'
						: 'Unknown';

	const os = /Windows/.test(ua)
		? 'Windows'
		: /Android/.test(ua)
			? 'Android'
			: /iPhone|iPad|iPod/.test(ua)
				? 'iOS'
				: /Mac OS X/.test(ua)
					? 'macOS'
					: /Linux/.test(ua)
						? 'Linux'
						: 'Unknown';

	return { browser, os, kind } as const;
}

/**
 * Creates a session for `user_id`. If that leaves the user over MAX_SESSIONS_PER_USER active
 * sessions, the least recently used ones are revoked with reason `session_limit`.
 */
export async function createSession(params: {
	user_id: string;
	ip?: string;
	user_agent?: string;
	/** overrides MAX_SESSIONS_PER_USER (the demo's shared accounts have many people on them at once) */
	max_sessions?: number;
}) {
	const now = new Date();
	const user_agent = (params.user_agent ?? '').slice(0, 300);
	const absolute_expires_at = new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS);

	const active = await SessionsModel.find({
		user: params.user_id,
		revoked_at: null,
		idle_expires_at: { $gt: now },
		absolute_expires_at: { $gt: now }
	})
		.sort({ last_seen_at: 1 })
		.select('_id')
		.lean<{ _id: unknown }[]>();

	const overflow = active.length - ((params.max_sessions ?? MAX_SESSIONS_PER_USER) - 1);
	if (overflow > 0) {
		await SessionsModel.updateMany(
			{ _id: { $in: active.slice(0, overflow).map((s) => s._id) } },
			{
				$set: {
					revoked_at: now,
					revoked_reason: session_revoke_reasons.SESSION_LIMIT
				}
			}
		);
	}

	const doc = await SessionsModel.create({
		user: params.user_id,
		idle_expires_at: new Date(
			Math.min(now.getTime() + SESSION_IDLE_TIMEOUT_MS, absolute_expires_at.getTime())
		),
		absolute_expires_at,
		last_seen_at: now,
		ip: params.ip ?? '',
		user_agent,
		device: parseUserAgent(user_agent),
		purge_at: new Date(absolute_expires_at.getTime() + SESSION_RETENTION_MS)
	});

	return String(doc._id);
}

/** Returns the session only if it is not revoked and inside both its idle and absolute limits. */
export async function getActiveSession(session_id: string): Promise<T_ActiveSession | null> {
	if (!/^[0-9a-f]{24}$/i.test(session_id)) return null;

	const now = new Date();
	const doc = await SessionsModel.findOne({
		_id: session_id,
		revoked_at: null,
		idle_expires_at: { $gt: now },
		absolute_expires_at: { $gt: now }
	})
		.select('user last_seen_at absolute_expires_at')
		.lean<{ _id: unknown; user: unknown; last_seen_at: Date; absolute_expires_at: Date }>();

	if (!doc) return null;

	return {
		_id: String(doc._id),
		user: String(doc.user),
		last_seen_at: doc.last_seen_at,
		absolute_expires_at: doc.absolute_expires_at
	};
}

/** Slides the idle timeout forward. Throttled, so most requests cause no write. */
export async function touchSession(session: T_ActiveSession) {
	const now = Date.now();
	if (now - new Date(session.last_seen_at).getTime() < SESSION_TOUCH_THROTTLE_MS) return;

	await SessionsModel.updateOne(
		{ _id: session._id, revoked_at: null },
		{
			$set: {
				last_seen_at: new Date(now),
				idle_expires_at: new Date(
					Math.min(now + SESSION_IDLE_TIMEOUT_MS, new Date(session.absolute_expires_at).getTime())
				)
			}
		}
	);
}

export async function revokeSession(
	session_id: string,
	reason: T_SessionRevokeReason,
	revoked_by?: string
) {
	if (!/^[0-9a-f]{24}$/i.test(session_id)) return;

	await SessionsModel.updateOne(
		{ _id: session_id, revoked_at: null },
		{ $set: { revoked_at: new Date(), revoked_reason: reason, revoked_by: revoked_by ?? null } }
	);
}

export async function revokeUserSessions(
	user_ids: string | string[],
	reason: T_SessionRevokeReason,
	revoked_by?: string
) {
	await SessionsModel.updateMany(
		{ user: { $in: Array.isArray(user_ids) ? user_ids : [user_ids] }, revoked_at: null },
		{ $set: { revoked_at: new Date(), revoked_reason: reason, revoked_by: revoked_by ?? null } }
	);
}

export type T_SessionListItem = {
	_id: string;
	created_at: Date;
	last_seen_at: Date;
	ip: string;
	device: { browser: string; os: string; kind: 'desktop' | 'mobile' | 'tablet' };
};

/** The user's sessions that are still usable, most recently active first. */
export async function getUserActiveSessions(user_id: string): Promise<T_SessionListItem[]> {
	const now = new Date();
	const docs = await SessionsModel.find({
		user: user_id,
		revoked_at: null,
		idle_expires_at: { $gt: now },
		absolute_expires_at: { $gt: now }
	})
		.select('created_at last_seen_at ip device')
		.sort({ last_seen_at: -1 })
		.lean<(Omit<T_SessionListItem, '_id'> & { _id: unknown })[]>();

	return docs.map((d) => ({ ...d, _id: String(d._id) }));
}

/** Revokes every active session of the user except `keep_session_id`. Returns how many ended. */
export async function revokeOtherUserSessions(
	user_id: string,
	keep_session_id: string,
	reason: T_SessionRevokeReason,
	revoked_by?: string
) {
	const result = await SessionsModel.updateMany(
		{ user: user_id, _id: { $ne: keep_session_id }, revoked_at: null },
		{ $set: { revoked_at: new Date(), revoked_reason: reason, revoked_by: revoked_by ?? null } }
	);
	return result.modifiedCount;
}
