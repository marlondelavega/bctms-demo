import { fail, message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	_username_exists,
	archiveUsers,
	createUser,
	getUser_byId,
	resetUserPassword,
	restoreUsers,
	updateUser
} from '$lib/server/services/Users.service';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { permissions } from '$lib/utilities/helper';
import {
	requireAccess,
	assertBatchOwnership,
	assertOwnership
} from '$lib/server/utilities/permissions.server';
import UsersModel from '$lib/server/models/Users.model';
import User from '$lib/validation_schemas/Users.zod';
import { uploadPhoto } from '$lib/server/utilities/upload_photo.server';
import { blockDemoUserEdit, blockDemoUsers } from '$lib/server/demo/guards';

const SCOPE_CONFIG = { ownField: 'created_by', officeField: 'enforcement_group' };

//initialize the validation schema in server for user restore and archive
export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	const create_form = await superValidate(zod4(User.CreateSchema), { id: 'create_form' });
	const edit_form = await superValidate(zod4(User.EditSchema), { id: 'edit_form' });
	const archive_form = await superValidate(zod4(User.ArchiveSchema), { id: 'archive_form' });
	const restore_form = await superValidate(zod4(User.ArchiveSchema), { id: 'restore_form' });
	const reset_password_form = await superValidate(zod4(User.ResetPasswordSchema), {
		id: 'reset_password_form'
	});

	if (permissions.get('users', user?.user_type.permissions as string[]).access == 'none') {
		return {
			create_form,
			edit_form,
			archive_form,
			restore_form,
			reset_password_form,
			authorized: false,
			message: 'You do not meet the necessary permission to view data.'
		};
	}

	return {
		create_form,
		edit_form,
		archive_form,
		restore_form,
		reset_password_form,
		authorized: true,
		message: ''
	};
};

//user archive and restore form actions
export const actions: Actions = {
	create: async ({ request, fetch, locals }) => {
		const form = await superValidate(request, zod4(User.CreateSchema), { id: 'create_form' });

		// a File can't be serialized back to the page, so take it off the form before any return
		const photo = form.data.files;
		form.data.files = undefined;

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Some fields need fixing. Check the highlighted fields.' },
				{ status: 400 }
			);
		}

		requireAccess(locals.user, 'users', 'create');

		form.data.firstname = form.data.firstname.toUpperCase();
		form.data.middlename = form.data.middlename?.toUpperCase();
		form.data.lastname = form.data.lastname.toUpperCase();

		try {
			// an empty file input arrives as a 0-byte File
			if (photo && photo.size > 0) {
				const uploaded = await uploadPhoto(fetch, photo);
				if ('error' in uploaded) {
					return message(
						form,
						{
							type: 'error',
							text: `${uploaded.error} Remove the photo to add this user without one.`
						},
						{ status: 400 }
					);
				}
				form.data.profile_image = uploaded.id;
			}

			const create_query = await createUser(form.data, locals.user);
			if (!create_query.success) {
				if (create_query.fields) {
					for (const [field, msg] of Object.entries(create_query.fields)) {
						setError(form, field as keyof typeof form.data, msg);
					}
				}
				return message(form, { type: 'error', text: create_query.message }, { status: 400 });
			}

			return message(form, {
				type: 'success',
				text: 'User created successfully.',
				data: {
					username: create_query.data.user.username,
					password: create_query.data.raw_password
				}
			});
		} catch (error) {
			if (error) return fail(400, { form });
		}
	},
	//edit user
	edit: async ({ request, fetch, locals }) => {
		const form = await superValidate(request, zod4(User.EditSchema), { id: 'edit_form' });

		// a File can't be serialized back to the page, so take it off the form before any return
		const photo = form.data.files;
		form.data.files = undefined;

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Some fields need fixing. Check the highlighted fields.' },
				{ status: 400 }
			);
		}

		const scope = requireAccess(locals.user, 'users', 'edit');
		const existing = await UsersModel.findById(form.data._id).lean();
		await assertOwnership(locals.user, scope, existing, SCOPE_CONFIG);

		const demo_block = await blockDemoUserEdit(form.data);
		if (demo_block) return message(form, { type: 'error', text: demo_block }, { status: 403 });

		form.data.firstname = form.data.firstname.toUpperCase();
		form.data.middlename = form.data.middlename?.toUpperCase();
		form.data.lastname = form.data.lastname.toUpperCase();

		// an empty file input arrives as a 0-byte File
		if (photo && photo.size > 0) {
			const uploaded = await uploadPhoto(fetch, photo);
			if ('error' in uploaded) {
				return message(
					form,
					{
						type: 'error',
						text: `${uploaded.error} Remove the new photo to save your other changes.`
					},
					{ status: 400 }
				);
			}
			form.data.profile_image = uploaded.id;
		}

		const _no_changes = await UsersModel.findOne({
			_id: form.data._id,
			profile_image: form.data.profile_image,
			enforcement_group: form.data.enforcement_group,
			user_type: form.data.user_type,
			firstname: form.data.firstname,
			middlename: form.data.middlename,
			lastname: form.data.lastname,
			username: form.data.username
		});

		if (_no_changes) {
			return message(
				form,
				{ type: 'error', text: 'Nothing has changed yet. Edit a field before saving.' },
				{ status: 400 }
			);
		}

		if (await _username_exists(form.data.username, form.data._id)) {
			return setError(form, 'username', 'That username is already taken. Choose another.');
		}

		const _old = await getUser_byId(form.data._id);
		const _c = await updateUser(form.data);

		if (!_c) {
			return message(
				form,
				{ type: 'error', text: 'This user could not be updated. Try again in a moment.' },
				{ status: 400 }
			);
		}

		const log_data: T_Log_C = {
			level: 'INFO',
			type: 'EDIT',
			message: 'edited user',
			source: 'users form action - edit',
			affected_collection: {
				collection_name: 'users',
				document_id: [_c._id.toString()]
			},
			user: logActor(locals.user),
			metadata: {
				from: _old,
				to: _c
			}
		};

		await createLog(log_data);

		return message(form, { type: 'success', text: 'User updated successfully.' });
	},
	//archive user
	archive: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(User.ArchiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const scope = requireAccess(locals.user, 'users', 'archive');
		await assertBatchOwnership(locals.user, scope, form.data._ids, UsersModel, SCOPE_CONFIG);

		const demo_block = await blockDemoUsers(form.data._ids, 'archived');
		if (demo_block) return message(form, { type: 'error', text: demo_block }, { status: 403 });

		try {
			const _f = await archiveUsers(form.data._ids, locals.user?._id);

			if (_f.acknowledged) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'ARCHIVE',
					message: 'archived user',
					source: 'user form action - archive',
					affected_collection: {
						collection_name: 'users',
						document_id: form.data._ids
					},
					user: logActor(locals.user)
				};

				await createLog(log_data);
			}

			return message(form, { type: 'success', text: 'Users archived successfully.' });
		} catch (error) {
			if (error) return fail(400, { form });
		}
	},
	//restore user
	restore: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(User.ArchiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const scope = requireAccess(locals.user, 'users', 'restore');
		await assertBatchOwnership(locals.user, scope, form.data._ids, UsersModel, SCOPE_CONFIG);

		try {
			const _f = await restoreUsers(form.data._ids);

			if (_f.acknowledged) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'RESTORE',
					message: 'restored user',
					source: 'user form action - restore',
					affected_collection: {
						collection_name: 'users',
						document_id: form.data._ids
					},
					user: logActor(locals.user)
				};

				await createLog(log_data);
			}

			return message(form, { type: 'success', text: 'Users restored successfully.' });
		} catch (error) {
			if (error) return fail(400, { form });
		}
	},
	//generate a new temporary password for a single user
	reset_password: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(User.ResetPasswordSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const scope = requireAccess(locals.user, 'users', 'edit');
		const existing = await UsersModel.findById(form.data._id).lean();
		await assertOwnership(locals.user, scope, existing, SCOPE_CONFIG);

		const demo_block = await blockDemoUsers([form.data._id], 'reset');
		if (demo_block) return message(form, { type: 'error', text: demo_block }, { status: 403 });

		try {
			const result = await resetUserPassword(form.data._id, locals.user?._id);

			if (!result.success) {
				return message(form, { type: 'error', text: result.message }, { status: 400 });
			}

			const log_data: T_Log_C = {
				level: 'INFO',
				type: 'EDIT',
				message: 'reset user password',
				source: 'user form action - reset_password',
				affected_collection: {
					collection_name: 'users',
					document_id: [form.data._id]
				},
				user: logActor(locals.user)
			};

			await createLog(log_data);

			return message(form, {
				type: 'success',
				text: 'Password reset successfully.',
				data: {
					username: result.data.user.username,
					password: result.data.raw_password
				}
			});
		} catch (error) {
			if (error) return fail(400, { form });
		}
	}
};
