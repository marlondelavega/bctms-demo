import mongoose, { type FilterQuery, type PipelineStage } from 'mongoose';
import argon2, { argon2id } from 'argon2';
import UsersModel from '../models/Users.model';

import { parseSearchParams, toObjectId } from '$lib/utilities/helper';
import User from '$lib/validation_schemas/Users.zod';
import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
import type UserType from '$lib/validation_schemas/UserTypes.zod';
import { customAlphabet } from 'nanoid';
import { service_fail, service_ok, type ServiceReturn } from './ReturnTypes';
import { revokeUserSessions } from './Sessions.service';
import SessionsModel, { session_revoke_reasons } from '../models/Sessions.model';

export async function getUsers(_q: URLSearchParams) {
	const { skip, limit, search, archived } = parseSearchParams(_q);

	const matchFilter: Record<string, unknown> = {
		combinedText: { $regex: search, $options: 'i' }
	};

	if (archived === -1) {
		matchFilter.archived = true;
	} else if (archived === 1) {
		matchFilter.archived = { $in: [false, null] };
	}

	const user_type_id = toObjectId(_q.get('user_type'));
	if (user_type_id) matchFilter['user_type._id'] = user_type_id;

	const created_by_id = toObjectId(_q.get('created_by'));
	if (created_by_id) matchFilter.created_by = created_by_id; // fine — created_by has no lookup, stays raw ObjectId

	const enforcement_group_id = toObjectId(_q.get('enforcement_group'));
	if (enforcement_group_id) matchFilter['enforcement_group._id'] = enforcement_group_id;

	// login state, from the sessions collection (rows are kept for a 90-day audit window, so
	// "logged in before" means within that window): online = has a live session right now
	const login = _q.get('login');
	if (login === 'online') {
		const now = new Date();
		matchFilter._id = {
			$in: await SessionsModel.distinct('user', {
				revoked_at: null,
				idle_expires_at: { $gt: now },
				absolute_expires_at: { $gt: now }
			})
		};
	} else if (login === 'ever') {
		matchFilter._id = { $in: await SessionsModel.distinct('user') };
	} else if (login === 'never') {
		matchFilter._id = { $nin: await SessionsModel.distinct('user') };
	}

	if (_q.get('access_levels')) {
		matchFilter['user_type.access_level'] = {
			$in: _q.get('access_levels')!.split(',').map(Number)
		};
	}

	const pipeline: PipelineStage[] = [
		{
			$addFields: {
				combinedText: {
					$concat: [{ $toString: '$_id' }, ' ', '$firstname', ' ', '$lastname']
				}
			}
		},
		{ $sort: { _id: -1 } },
		{
			$lookup: {
				from: 'user_types',
				localField: 'user_type',
				foreignField: '_id',
				as: 'user_type'
			}
		},
		{
			$lookup: {
				from: 'enforcement_groups',
				localField: 'enforcement_group',
				foreignField: '_id',
				as: 'enforcement_group'
			}
		},
		{
			$unwind: {
				path: '$user_type',
				preserveNullAndEmptyArrays: true
			}
		},
		{
			$unwind: {
				path: '$enforcement_group',
				preserveNullAndEmptyArrays: true
			}
		},
		{ $match: matchFilter },

		{
			$project: {
				password: 0
			}
		},
		{
			$unset: 'combinedText'
		},
		{
			$facet: {
				count: [{ $count: 'total' }],
				data: [
					{ $skip: skip },
					{ $limit: limit },
					{
						$unwind: {
							path: '$user_type',
							preserveNullAndEmptyArrays: true
						}
					},
					{
						$unwind: {
							path: '$enforcement_group',
							preserveNullAndEmptyArrays: true
						}
					}
				]
			}
		},
		{
			$project: {
				count: { $first: '$count.total' },
				data: 1
			}
		}
	];

	const res = await UsersModel.aggregate<{
		count: number | null;
		data: User.Base[];
	}>(pipeline).exec();

	const result = res[0] ?? { count: 0, data: [] };

	// last login = newest session's creation time, looked up only for this page's rows. Users who
	// haven't logged in since sessions were introduced get null.
	const last_logins = result.data.length
		? await SessionsModel.aggregate<{ _id: unknown; last_login: Date }>([
				{ $match: { user: { $in: result.data.map((u) => new mongoose.Types.ObjectId(u._id)) } } },
				{ $group: { _id: '$user', last_login: { $max: '$created_at' } } }
			])
		: [];
	const last_login_by_user = new Map(last_logins.map((s) => [String(s._id), s.last_login]));
	for (const u of result.data) u.last_login = last_login_by_user.get(String(u._id)) ?? null;

	return {
		total: result.count ?? 0,
		data: result.data
	};
}

export async function getUser_byId(_id: string) {
	return await UsersModel.findById(_id)
		.select('-password')
		.populate('user_type')
		.populate('enforcement_group')
		.lean<User.Base<EnforcementGroup.Base, UserType.Base> | null>()
		.exec();
}

export async function getUser_byId_withPassword(
	_id: string
): Promise<ServiceReturn<User.Base<EnforcementGroup.Base, UserType.Base>>> {
	let _q = await UsersModel.findById(_id)
		.select('+password')
		.populate('user_type')
		.populate('enforcement_group')
		.lean<User.Base<EnforcementGroup.Base, UserType.Base> | null>();

	if (!_q || _q == null) return service_fail('User does not exist.');

	return service_ok('Successfully retrieved user data.', _q);
}

export async function _username_exists(username: string, _id?: string) {
	const found = await UsersModel.findOne({
		username: username,
		...(_id ? { _id: { $ne: _id } } : {})
	}).lean();
	return !!found;
}

export async function usernameExists(
	data: User.Create | User.Edit
): Promise<ServiceReturn<boolean>> {
	try {
		const query: FilterQuery<User.Base> = { username: data.username };
		if ('_id' in data && data._id != '') query._id = { $ne: data._id };

		const exists = await UsersModel.exists(query);
		return service_ok('Username availability checked.', Boolean(exists));
	} catch {
		return service_fail('Failed to check username availability.');
	}
}

export async function generatePassword(): Promise<ServiceReturn<{ hashed: string; raw: string }>> {
	const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
	const tid = customAlphabet(alphabet, 8);
	const raw = tid();
	const hashed = await argon2.hash(raw, { type: argon2id });

	if (!raw || !hashed)
		return service_fail('Cannot generate a temporary password. Please try again.');

	return service_ok('Successfully generated password.', { hashed, raw });
}

export async function createUser(
	data: User.Create,
	user: User.Base<EnforcementGroup.Base, UserType.Base> | undefined
): Promise<ServiceReturn<{ user: User.Base; raw_password: string }>> {
	const gen = await generatePassword();
	if (!gen.success) return service_fail(gen.message);
	const { hashed, raw } = gen.data;

	const exists = await usernameExists(data);
	if (!exists.success) return service_fail(exists.message);
	if (exists.data)
		return service_fail('Username already taken. Please try another.', {
			username: 'Username already taken.'
		});

	try {
		const doc = await UsersModel.create({ ...data, password: hashed, created_by: user?._id });
		return service_ok('Successfully created a new user.', { user: doc, raw_password: raw });
	} catch {
		return service_fail('There was a problem creating the user. Please try again later.');
	}
}

// Once a user has set their own password, admins can't reset it again within this window.
export const PASSWORD_RESET_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function resetUserPassword(
	_id: string,
	revoked_by?: string
): Promise<ServiceReturn<{ user: User.Base; raw_password: string }>> {
	// Cooldown only applies after the user has changed their own temporary password. Legacy
	// users without a last-change date are treated as having no recent change.
	const current = await UsersModel.findById(_id)
		.select('password_change last_password_change_date')
		.lean<{ password_change?: boolean; last_password_change_date?: Date }>();
	if (!current) return service_fail('User not found.');

	if (current.password_change === false && current.last_password_change_date) {
		const available_at = new Date(
			new Date(current.last_password_change_date).getTime() + PASSWORD_RESET_COOLDOWN_MS
		);
		if (available_at.getTime() > Date.now())
			return service_fail(
				`This user changed their password recently. Try again after ${available_at.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })}.`
			);
	}

	const gen = await generatePassword();
	if (!gen.success) return service_fail(gen.message);
	const { hashed, raw } = gen.data;

	const doc = await UsersModel.findOneAndUpdate(
		{ _id },
		{ $set: { password: hashed, password_change: true, last_password_change_date: new Date() } },
		{ new: true }
	).lean<User.Base>();

	if (!doc) return service_fail('User not found.');

	// the old password is dead immediately, so any session opened with it must be too
	await revokeUserSessions(_id, session_revoke_reasons.PASSWORD_RESET, revoked_by);

	return service_ok('Successfully generated a new password.', { user: doc, raw_password: raw });
}

export async function updateUser(data: User.Edit) {
	const update = UsersModel.findOneAndUpdate(
		{ _id: new mongoose.Types.ObjectId(data._id) },
		{ ...data },
		{ new: true }
	);

	return update;
}

export async function archiveUsers(archive_ids: string[], revoked_by?: string) {
	const archive = await UsersModel.updateMany(
		{ _id: { $in: archive_ids } },
		{ $set: { archived: true } }
	);

	if (archive.acknowledged)
		await revokeUserSessions(archive_ids, session_revoke_reasons.USER_ARCHIVED, revoked_by);

	return archive;
}

export async function restoreUsers(restore_ids: string[]) {
	const restore = await UsersModel.updateMany(
		{ _id: { $in: restore_ids } },
		{ $set: { archived: false } }
	);

	return restore;
}
