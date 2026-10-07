import { env } from '$env/dynamic/private';
import UsersModel from '$lib/server/models/Users.model';
import UserTypesModel from '$lib/server/models/UserTypes.model';
import { DEMO_PROTECTED_USER_TYPES, demoUsernames } from './accounts';

/**
 * Demo-only restrictions. Visitors share the featured accounts, so they must not be able to lock
 * each other out or strip the roles the demo depends on. Each guard returns the message to show
 * the visitor, or `null` when the action is fine (always `null` outside demo mode). Keep this list
 * as short as possible: everything else in the app should behave exactly as it does in production.
 */
export const isDemoMode = () => env.DEMO_MODE === 'true';

const SHARED = 'This is a shared demo account, so';

/** A demo account may not change its own password. */
export function blockDemoPasswordChange(user: { username?: string } | null | undefined) {
	if (!isDemoMode() || !user?.username || !demoUsernames.has(user.username)) return null;
	return `${SHARED} its password can't be changed.`;
}

async function demoAccountsAmong(ids: string[]) {
	const users = await UsersModel.find({ _id: { $in: ids } }, { username: 1 }).lean<
		{ username: string }[]
	>();
	return users.filter((u) => demoUsernames.has(u.username));
}

/** Resetting the password of, or archiving, a demo account. */
export async function blockDemoUsers(ids: string[], verb: 'reset' | 'archived') {
	if (!isDemoMode() || !ids.length) return null;
	if (!(await demoAccountsAmong(ids)).length) return null;
	return verb === 'reset'
		? `${SHARED} its password can't be reset.`
		: `${SHARED} it can't be archived.`;
}

/** Changing a demo account's username, office or role. */
export async function blockDemoUserEdit(change: {
	_id: string;
	username: string;
	user_type: string;
	enforcement_group: string;
}) {
	if (!isDemoMode()) return null;
	const [account] = await demoAccountsAmong([change._id]);
	if (!account) return null;

	const current = await UsersModel.findById(change._id, {
		username: 1,
		user_type: 1,
		enforcement_group: 1
	}).lean<{ username: string; user_type: unknown; enforcement_group: unknown } | null>();
	if (!current) return null;

	const same =
		current.username === change.username &&
		String(current.user_type) === change.user_type &&
		String(current.enforcement_group) === change.enforcement_group;
	return same ? null : `${SHARED} its username, office and user type can't be changed.`;
}

/** Editing or archiving one of the seeded user types, which would change what the demo accounts can do. */
export async function blockDemoUserTypes(ids: string[]) {
	if (!isDemoMode() || !ids.length) return null;
	const types = await UserTypesModel.find({ _id: { $in: ids } }, { user_type: 1 }).lean<
		{ user_type: string }[]
	>();
	if (!types.some((t) => DEMO_PROTECTED_USER_TYPES.includes(t.user_type))) return null;
	return "The demo's built-in user types can't be edited or archived. You can create your own user type instead.";
}
