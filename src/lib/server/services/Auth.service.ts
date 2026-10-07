import type Login from '$lib/validation_schemas/Login.zod';
import type User from '$lib/validation_schemas/Users.zod';
import UsersModel from '../models/Users.model';
import argon2, { argon2id } from 'argon2';
import { getUser_byId_withPassword } from './Users.service';
import { service_fail, service_ok, type ServiceReturn } from './ReturnTypes';
import { revokeUserSessions } from './Sessions.service';
import { session_revoke_reasons } from '../models/Sessions.model';

export async function validateUsername(credentials: Login.Credentials) {
	return UsersModel.findOne({
		username: credentials.username,
		archived: { $in: [false, null, undefined] }
	})
		.select('-password -user_type -enforcement_group -archived -profile_image -date_created')
		.lean<User.Base>();
}

export async function validateAccount(credentials: Login.Credentials) {
	const _f = await UsersModel.findOne({
		username: credentials.username,
		archived: { $in: [false, null, undefined] }
	}).select('+password');

	if (_f) {
		return await argon2.verify(_f.password, credentials.password);
	}

	return false;
}

export async function changePassword(
	data: Login.ChangePassword,
	user: User.Base
): Promise<ServiceReturn<User.Base>> {
	const user_data = await getUser_byId_withPassword(user._id);

	if (!user_data.success) return service_fail(user_data.message);

	if (user_data.data.archived) return service_fail('Invalid user. Please login and try again.');

	const valid_current_pw = await argon2.verify(user_data.data.password, data.current_password);
	if (!valid_current_pw) return service_fail('Current password is incorrect.');

	const hashed = await argon2.hash(data.new_password, { type: argon2id });

	const update = await UsersModel.findOneAndUpdate(
		{ _id: user_data.data._id },
		{ $set: { password: hashed, password_change: false, last_password_change_date: new Date() } },
		{ returnDocument: 'after' }
	).lean<User.Base>();
	if (!update) return service_fail('Could not process your request. Please try again later.');

	// the caller logs the user out and sends them to /login, so end every session of theirs
	await revokeUserSessions(String(update._id), session_revoke_reasons.PASSWORD_CHANGED, user._id);

	return service_ok('Password changed successfully.', update);
}
