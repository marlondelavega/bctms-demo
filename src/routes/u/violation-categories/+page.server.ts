import { fail, message, superValidate } from 'sveltekit-superforms';
import type { PageServerLoad } from './$types';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions } from '@sveltejs/kit';
import {
	archiveViolationCategories,
	createViolationCategory,
	getViolationCategory_byId,
	restoreViolationCategories,
	updateViolationCategory
} from '$lib/server/services/ViolationCategories.service';
import ViolationCategoryModel from '$lib/server/models/ViolationCategories.model';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import mongoose from 'mongoose';
import { permissions } from '$lib/utilities/helper';
import ViolationCategory from '$lib/validation_schemas/ViolationCategories.zod';
import {
	requireAccess,
	assertOwnership,
	assertBatchOwnership
} from '$lib/server/utilities/permissions.server';

const SCOPE_CONFIG = { ownField: 'created_by' };

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	const createForm = await superValidate(zod4(ViolationCategory.CreateSchema), {
		defaults: { name: '', description: '', sub_categories: [{ name: '' }] }
	});

	const editForm = await superValidate(zod4(ViolationCategory.EditSchema));

	const archiveForm = await superValidate(zod4(ViolationCategory.ArchiveSchema), {
		id: 'archive'
	});

	const restoreForm = await superValidate(zod4(ViolationCategory.ArchiveSchema), {
		id: 'restore'
	});

	if (
		permissions.get('violation_categories', user?.user_type.permissions as string[]).access ==
		'none'
	) {
		return {
			createForm,
			editForm,
			archiveForm,
			restoreForm,
			authorized: false,
			message: 'You do not meet the necessary permission to view data.'
		};
	}

	return {
		createForm,
		editForm,
		archiveForm,
		restoreForm,
		authorized: true,
		message: ''
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requireAccess(locals.user, 'violation_categories', 'create');

		const form = await superValidate(request, zod4(ViolationCategory.CreateSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		try {
			const _found_existing = await ViolationCategoryModel.findOne({ name: form.data.name });

			if (_found_existing) {
				form.errors.name = ['This violation category already exists.'];

				return message(
					form,
					{
						type: 'error',
						text: 'This category already exists. Please try again or use a different name.'
					},
					{ status: 400 }
				);
			}

			const _f = await createViolationCategory(form.data, locals.user);

			if (!_f) {
				return message(
					form,
					{
						type: 'error',
						text: 'Unexpected error, could not create category. Please try again later.'
					},
					{ status: 400 }
				);
			} else if (_f) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'CREATE',
					message: 'created violation category',
					source: 'violation category form action - create',
					affected_collection: {
						collection_name: 'violation_categories',
						document_id: [_f._id.toString()]
					},
					user: logActor(locals.user)
				};

				await createLog(log_data);
			}

			return message(form, { type: 'success', text: 'Violation category created successfully.' });
		} catch (error) {
			if (error) return fail(400, { form });
			return fail(400, { form });
		}
	},

	edit: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(ViolationCategory.EditSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const edit_scope = requireAccess(locals.user, 'violation_categories', 'edit');
		const existing_category = await ViolationCategoryModel.findById(form.data._id).lean();
		await assertOwnership(locals.user, edit_scope, existing_category, SCOPE_CONFIG);

		const _no_changes = await ViolationCategoryModel.findOne({
			_id: new mongoose.Types.ObjectId(form.data._id),
			name: form.data.name,
			description: form.data.description,
			sub_categories: form.data.sub_categories
		});

		const _found_existing = await ViolationCategoryModel.findOne({
			name: form.data.name,
			_id: { $ne: new mongoose.Types.ObjectId(form.data._id) }
		});

		if (_no_changes) {
			return message(
				form,
				{
					type: 'error',
					text: 'No changes found. Please modify the form to update this category.'
				},
				{ status: 400 }
			);
		} else if (_found_existing) {
			form.errors.name = ['A category with this name already exists.'];
			return message(
				form,
				{
					type: 'error',
					text: 'Name already exists. Please try a different name.'
				},
				{ status: 400 }
			);
		}

		const _old = await getViolationCategory_byId(form.data._id);

		const _f = await updateViolationCategory(form.data);

		if (_f) {
			const log_data: T_Log_C = {
				level: 'INFO',
				type: 'EDIT',
				message: 'updated violation category',
				source: 'violation category form action - edit',
				affected_collection: {
					collection_name: 'violation_categories',
					document_id: [_f._id.toString()]
				},
				user: logActor(locals.user),
				metadata: {
					from: _old,
					to: _f
				}
			};

			await createLog(log_data);
		}

		return message(form, { type: 'success', text: 'Violation category updated successfully.' });
	},

	archive: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(ViolationCategory.ArchiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const archive_scope = requireAccess(locals.user, 'violation_categories', 'archive');
		await assertBatchOwnership(
			locals.user,
			archive_scope,
			form.data._ids,
			ViolationCategoryModel,
			SCOPE_CONFIG
		);

		try {
			const _f = await archiveViolationCategories(form.data._ids);

			if (_f.acknowledged) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'ARCHIVE',
					message: 'archived violation category',
					source: 'violation category action - archive',
					affected_collection: {
						collection_name: 'violation_categories',
						document_id: form.data._ids
					},
					user: logActor(locals.user)
				};

				await createLog(log_data);
			}

			return message(form, {
				type: 'success',
				text: 'Violation categories archived successfully.'
			});
		} catch (error) {
			if (error) return fail(400, { form });
		}
	},

	restore: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(ViolationCategory.ArchiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const restore_scope = requireAccess(locals.user, 'violation_categories', 'restore');
		await assertBatchOwnership(
			locals.user,
			restore_scope,
			form.data._ids,
			ViolationCategoryModel,
			SCOPE_CONFIG
		);

		try {
			const _f = await restoreViolationCategories(form.data._ids);

			if (_f.acknowledged) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'RESTORE',
					message: 'restored violation categories',
					source: 'violation categories action - restore',
					affected_collection: {
						collection_name: 'violation_categories',
						document_id: form.data._ids
					},
					user: logActor(locals.user)
				};

				await createLog(log_data);
			}

			return message(form, {
				type: 'success',
				text: 'Violation categories restored successfully.'
			});
		} catch (error) {
			if (error) return fail(400, { form });
		}
	}
};
