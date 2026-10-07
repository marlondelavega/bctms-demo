import type { PipelineStage } from 'mongoose';
import type { T_Log_C } from '../models/Logs.model';
import LogsModel from '../models/Logs.model';
import UsersModel from '../models/Users.model';
import { requireAccess, type ScopedUser } from '../utilities/permissions.server';
import { parseNumber, toObjectId } from '$lib/utilities/helper';

export async function createLog(data: T_Log_C) {
	try {
		return await LogsModel.create(data);
	} catch (err) {
		// a failed audit write should never break the mutation it's logging
		console.error('Failed to write log entry', err);
	}
}

type ActorSource =
	| {
			_id: string;
			firstname?: string;
			lastname?: string;
			username?: string;
			user_type?: { user_type?: string } | string | null;
	  }
	| null
	| undefined;

/** Builds a T_Log_C['user'] snapshot from the signed-in user — trimmed, never the raw user document. */
export function logActor(user: ActorSource): T_Log_C['user'] {
	if (!user) return { user_id: '' };

	const name = [user.firstname, user.lastname].filter(Boolean).join(' ').trim();
	const user_type =
		user.user_type && typeof user.user_type === 'object'
			? user.user_type.user_type
			: user.user_type;

	return {
		user_id: String(user._id),
		user_data: {
			name: name || undefined,
			username: user.username,
			user_type: user_type ?? undefined
		}
	};
}

// older log rows were written under these names before they were normalized
const LEGACY_COLLECTION_NAMES: Record<string, string[]> = {
	enforcement_groups: ['enforcement_group'],
	code_provisions: ['code_provision']
};

function escapeRegex(str: string) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function groupId(user: ScopedUser): string | null {
	const eg = user.enforcement_group;
	if (!eg) return null;
	return typeof eg === 'string' ? eg : String(eg._id);
}

async function getOfficeUserIds(enforcementGroupId: string): Promise<string[]> {
	const id = toObjectId(enforcementGroupId);
	if (!id) return [];
	const ids = await UsersModel.find({ enforcement_group: id }).distinct('_id');
	return ids.map((v: unknown) => String(v));
}

/** Logs are actor-scoped ('user.user_id' is a plain string, unlike ownField refs elsewhere), so this
 *  builds its own scope filter rather than reusing the generic ObjectId-based scopeFilter. */
async function logsScopeFilter(user: ScopedUser, scope: string): Promise<Record<string, unknown>> {
	if (scope === 'all') return {};
	if (scope === 'own') return { 'user.user_id': String(user._id) };

	if (scope === 'office') {
		const gid = groupId(user);
		const officeUserIds = gid ? await getOfficeUserIds(gid) : [];
		return { 'user.user_id': { $in: officeUserIds } };
	}

	return { _id: toObjectId('000000000000000000000000') };
}

/** Every non-empty value of a repeatable filter (`?level=INFO&level=ERROR`). */
export function multiParam(params: URLSearchParams, key: string): string[] {
	return [
		...new Set(
			params
				.getAll(key)
				.map((v) => v.trim())
				.filter(Boolean)
		)
	];
}

function dateRange(params: URLSearchParams) {
	const from = params.get('date_from');
	const to = params.get('date_to');
	const range: Record<string, Date> = {};
	if (from) range.$gte = new Date(`${from}T00:00:00`);
	if (to) range.$lte = new Date(`${to}T23:59:59.999`);
	return Object.keys(range).length ? range : null;
}

export async function getLogs(user: ScopedUser, params: URLSearchParams) {
	const scope = requireAccess(user, 'logs');

	const match: Record<string, unknown> = await logsScopeFilter(user, scope);

	const levels = multiParam(params, 'level');
	if (levels.length) match.level = { $in: levels };

	const types = multiParam(params, 'type');
	if (types.length) match.type = { $in: types };

	const collections = multiParam(params, 'collection');
	if (collections.length) {
		match['affected_collection.collection_name'] = {
			$in: collections.flatMap((c) => [c, ...(LEGACY_COLLECTION_NAMES[c] ?? [])])
		};
	}

	const created_at = dateRange(params);
	if (created_at) match.created_at = created_at;

	const search = params.get('search')?.trim();
	if (search) {
		const regex = { $regex: escapeRegex(search), $options: 'i' };
		match.$or = [
			{ message: regex },
			{ source: regex },
			{ 'user.user_data.name': regex },
			{ 'user.user_data.username': regex }
		];
	}

	const limit = Math.min(parseNumber(params.get('size'), 10), 100);
	const page = parseNumber(params.get('page'), 1);
	const skip = (page - 1) * limit;

	const pipeline: PipelineStage[] = [
		{ $match: match },
		{ $sort: { created_at: -1 } },
		{
			$facet: {
				count: [{ $count: 'total' }],
				data: [{ $skip: skip }, { $limit: limit }]
			}
		},
		{ $project: { count: { $first: '$count.total' }, data: 1 } }
	];

	const [result] = await LogsModel.aggregate(pipeline);

	return {
		scope,
		total: result?.count ?? 0,
		data: JSON.parse(JSON.stringify(result?.data ?? []))
	};
}
