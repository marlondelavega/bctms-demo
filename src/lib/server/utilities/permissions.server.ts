import { error } from '@sveltejs/kit';
import { permissions } from '$lib/utilities/helper';
import { toObjectId } from '$lib/utilities/helper';
import UsersModel from '$lib/server/models/Users.model';
import IssuanceModel from '$lib/server/models/Issuance.model';
import type { Model } from 'mongoose';
import type {
	permission_action,
	permission_resource,
	permission_scope
} from '$lib/server/models/UserTypes.model';

export type ScopedUser = {
	_id: string;
	enforcement_group?: { _id: string } | string | null;
	user_type: { permissions: string[] };
};

export type ScopeConfig = {
	/** Field on the resource's own collection that stores the creator/owner. */
	ownField: string;
	/** Field on the resource's own collection that refs enforcement_groups directly, if any. */
	officeField?: string;
	/** Full override for how 'office' scope is expressed, for resources that don't fit the own/office-field shape. */
	officeFilter?: (user: ScopedUser) => Record<string, unknown>;
};

function extractId(value: unknown): string | null {
	if (!value) return null;
	if (typeof value === 'string') return value;
	if (typeof value === 'object' && '_id' in (value as Record<string, unknown>)) {
		return String((value as { _id: unknown })._id);
	}
	return String(value);
}

function groupId(user: ScopedUser): string | null {
	return extractId(user.enforcement_group);
}

/**
 * Checks whether `user`'s user type grants `action` on `resource` at all.
 * Throws a 401 if not; otherwise returns the granted scope ('all' | 'office' | 'own').
 */
export function requireAccess(
	user: ScopedUser | null | undefined,
	resource: permission_resource,
	action: permission_action = 'access'
): permission_scope {
	if (!user) {
		error(401, 'Access denied');
	}

	const scope = permissions.get(resource, user.user_type?.permissions)[action];

	if (!scope || scope === 'none') {
		error(401, 'You do not have the necessary permission to perform this action.');
	}

	return scope as permission_scope;
}

/** Users belonging to the same enforcement group as `enforcementGroupId`, used as the office-scope fallback. */
async function getOfficeUserIds(enforcementGroupId: string): Promise<string[]> {
	const id = toObjectId(enforcementGroupId);
	if (!id) return [];
	const ids = await UsersModel.find({ enforcement_group: id }).distinct('_id');
	return ids.map((v: unknown) => String(v));
}

/**
 * Builds the Mongo filter fragment that expresses `scope` for a list query, per `config`.
 */
export async function scopeFilter(
	user: ScopedUser,
	scope: permission_scope,
	config: ScopeConfig
): Promise<Record<string, unknown>> {
	if (scope === 'all') return {};

	if (scope === 'own') {
		return { [config.ownField]: toObjectId(user._id) };
	}

	if (scope === 'office') {
		if (config.officeFilter) return config.officeFilter(user);

		if (config.officeField) {
			const gid = groupId(user);
			return gid ? { [config.officeField]: toObjectId(gid) } : { [config.ownField]: null };
		}

		const gid = groupId(user);
		const officeUserIds = gid ? await getOfficeUserIds(gid) : [];
		return { [config.ownField]: { $in: officeUserIds.map((id) => toObjectId(id)) } };
	}

	// 'none' / unknown — match nothing
	return { _id: toObjectId('000000000000000000000000') };
}

/**
 * For a single already-fetched record, throws a 403 if it falls outside `scope` per `config`.
 * No-op for 'all' scope.
 */
export async function assertOwnership(
	user: ScopedUser,
	scope: permission_scope,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	record: any,
	config: ScopeConfig
): Promise<void> {
	if (!record) {
		error(404, 'Not found');
	}
	if (scope === 'all') return;

	if (scope === 'own') {
		if (extractId(record[config.ownField]) !== String(user._id)) {
			error(403, 'You do not have permission to access this record.');
		}
		return;
	}

	if (scope === 'office') {
		if (config.officeFilter) {
			const filter = config.officeFilter(user);
			const ok = Object.entries(filter).every(
				([key, val]) => extractId(record[key]) === extractId(val)
			);
			if (!ok) {
				error(403, 'You do not have permission to access this record.');
			}
			return;
		}

		if (config.officeField) {
			const gid = groupId(user);
			if (!gid || extractId(record[config.officeField]) !== gid) {
				error(403, 'You do not have permission to access this record.');
			}
			return;
		}

		const gid = groupId(user);
		const officeUserIds = gid ? await getOfficeUserIds(gid) : [];
		const ownerId = extractId(record[config.ownField]);
		if (!ownerId || !officeUserIds.includes(ownerId)) {
			error(403, 'You do not have permission to access this record.');
		}
		return;
	}

	error(403, 'You do not have permission to access this record.');
}

/**
 * For a batch action (archive/restore) on a list of ids, throws a 403 if any of the targeted
 * documents fall outside `scope`, rather than silently archiving/restoring a partial subset.
 * No-op for 'all' scope.
 */
export async function assertBatchOwnership(
	user: ScopedUser,
	scope: permission_scope,
	ids: string[],
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	model: Model<any>,
	config: ScopeConfig
): Promise<void> {
	if (scope === 'all' || ids.length === 0) return;

	const filter = await scopeFilter(user, scope, config);
	const objectIds = ids.map((id) => toObjectId(id)).filter(Boolean);
	const matching = await model.countDocuments({ ...filter, _id: { $in: objectIds } });

	if (matching !== ids.length) {
		error(403, 'You do not have permission to modify one or more of the selected records.');
	}
}

/**
 * Billing has no owner/office field of its own — it's scoped via the issuance it belongs to
 * (billing.issuance -> issuance.issuer -> issuer's enforcement group).
 */
export async function billingScopeFilter(
	user: ScopedUser,
	scope: permission_scope
): Promise<Record<string, unknown>> {
	if (scope === 'all') return {};

	if (scope === 'own') {
		const issuanceIds = await IssuanceModel.find({ issuer: toObjectId(user._id) }).distinct('_id');
		return { issuance: { $in: issuanceIds } };
	}

	if (scope === 'office') {
		const gid = groupId(user);
		const officeUserIds = gid ? await getOfficeUserIds(gid) : [];
		const issuanceIds = await IssuanceModel.find({
			issuer: { $in: officeUserIds.map((id) => toObjectId(id)) }
		}).distinct('_id');
		return { issuance: { $in: issuanceIds } };
	}

	return { issuance: toObjectId('000000000000000000000000') };
}

/** Ownership check for a single already-fetched billing record — see billingScopeFilter. */
export async function assertBillingOwnership(
	user: ScopedUser,
	scope: permission_scope,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	record: any
): Promise<void> {
	if (!record) {
		error(404, 'Not found');
	}
	if (scope === 'all') return;

	const issuanceId = extractId(record.issuance);
	const issuance = issuanceId ? await IssuanceModel.findById(issuanceId) : null;
	await assertOwnership(user, scope, issuance, { ownField: 'issuer' });
}
