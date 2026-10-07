import { fail, type Actions } from '@sveltejs/kit';
import {
	archiveEnforcementGroups,
	createEnforcementGroup,
	getEnforcementGroup_byId,
	restoreEnforcementGroups,
	updateEnforcementGroup,
	updateIncentiveSettings
} from '$lib/server/services/EnforcementGroup.service';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { PageServerLoad } from './$types';
import EnforcementGroupsModel from '$lib/server/models/EnforcementGroups.model';
import mongoose from 'mongoose';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import { permissions } from '$lib/utilities/helper';
import EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
import {
	requireAccess,
	assertOwnership,
	assertBatchOwnership
} from '$lib/server/utilities/permissions.server';

const SCOPE_CONFIG = {
	ownField: 'created_by',
	officeFilter: (u: { enforcement_group?: { _id: string } | string | null }) => ({
		_id: u.enforcement_group
	})
};

//initialize the validation schema in server for enforcement group, use load
export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	const createForm = await superValidate(zod4(EnforcementGroup.CreateSchema));
	const editForm = await superValidate(zod4(EnforcementGroup.EditSchema));
	const archiveForm = await superValidate(zod4(EnforcementGroup.ArchiveSchema), {
		id: 'group_archiveForm'
	});
	const restoreForm = await superValidate(zod4(EnforcementGroup.ArchiveSchema), {
		id: 'group_restoreForm'
	});
	const incentiveForm = await superValidate(zod4(EnforcementGroup.IncentiveSchema), {
		id: 'group_incentiveForm'
	});

	if (permissions.get('enforcement_groups', user?.user_type.permissions).access == 'none') {
		return {
			createForm,
			editForm,
			archiveForm,
			restoreForm,
			incentiveForm,
			authorized: false,
			message: 'You do not meet the necessary permission to view data.'
		};
	}
	return {
		createForm,
		editForm,
		archiveForm,
		restoreForm,
		incentiveForm,
		authorized: true,
		message: ''
	};
};

//enforcement group actions
export const actions: Actions = {
	//create enforcement group
	create: async ({ request, locals }) => {
		requireAccess(locals.user, 'enforcement_groups', 'create');

		//validate using superValidate
		const form = await superValidate(request, zod4(EnforcementGroup.CreateSchema));

		//return message with status 400 if NOT valid
		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		try {
			const _found_existing = await EnforcementGroupsModel.findOne({ name: form.data.name });
			if (_found_existing) {
				form.errors.name = ['An enforcement group with this name already exists.'];
				return message(
					form,
					{
						type: 'error',
						text: 'Enforcement group already exists. Please try a different name.'
					},
					{ status: 400 }
				);
			}
			//create new enforcement group document
			const _f = await createEnforcementGroup(form.data, locals.user);

			if (_f) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'CREATE',
					message: 'created enforcement group',
					source: 'enforcement group form action - create',
					affected_collection: {
						collection_name: 'enforcement_groups',
						document_id: [_f._id.toString()]
					},
					user: logActor(locals.user)
				};

				await createLog(log_data);
			}

			//return success using message()
			return message(form, { type: 'success', text: 'Enforcement group created successfully.' });
		} catch (error) {
			//if all else fails return fail()
			if (error) return fail(400, { form });
		}
	},
	//edit enforcement group
	edit: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(EnforcementGroup.EditSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const edit_scope = requireAccess(locals.user, 'enforcement_groups', 'edit');
		const existing_group = await EnforcementGroupsModel.findById(form.data._id).lean();
		await assertOwnership(locals.user, edit_scope, existing_group, SCOPE_CONFIG);

		try {
			const _no_changes = await EnforcementGroupsModel.findOne({
				_id: new mongoose.Types.ObjectId(form.data._id),
				name: form.data.name,
				description: form.data.description
			});
			const _found_existing = await EnforcementGroupsModel.findOne({
				name: form.data.name
			});

			if (_no_changes) {
				return message(
					form,
					{
						type: 'error',
						text: 'No changes found. Please modify the form to update this enforcement group.'
					},
					{ status: 400 }
				);
			} else if (_found_existing) {
				form.errors.name = ['An enforcement group with this name already exists.'];
				return message(
					form,
					{
						type: 'error',
						text: 'Enforcement group already exists. Please try a different name.'
					},
					{ status: 400 }
				);
			}

			const _old = await getEnforcementGroup_byId(form.data._id);

			const _f = await updateEnforcementGroup(form.data);

			if (_f) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'EDIT',
					message: 'edited enforcement group',
					source: 'enforcement group form action - edit',
					affected_collection: {
						collection_name: 'enforcement_groups',
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

			return message(form, { type: 'success', text: 'User type edited successfully.' });
		} catch (error) {
			if (error) return fail(400, { form });
		}
	},
	//archive enforcement group
	archive: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(EnforcementGroup.ArchiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const archive_scope = requireAccess(locals.user, 'enforcement_groups', 'archive');
		await assertBatchOwnership(
			locals.user,
			archive_scope,
			form.data._ids,
			EnforcementGroupsModel,
			SCOPE_CONFIG
		);

		try {
			const _f = await archiveEnforcementGroups(form.data._ids);

			if (_f.acknowledged) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'ARCHIVE',
					message: 'archived enforcement group',
					source: 'enforcement group form action - archive',
					affected_collection: {
						collection_name: 'enforcement_groups',
						document_id: form.data._ids
					},
					user: logActor(locals.user)
				};

				await createLog(log_data);
			}

			return message(form, { type: 'success', text: 'Enforcement groups archived successfully.' });
		} catch (error) {
			if (error) return fail(400, { form });
		}
	},
	//restore enforcement group
	restore: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(EnforcementGroup.ArchiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Form is not valid. Please try again.' },
				{ status: 400 }
			);
		}

		const restore_scope = requireAccess(locals.user, 'enforcement_groups', 'restore');
		await assertBatchOwnership(
			locals.user,
			restore_scope,
			form.data._ids,
			EnforcementGroupsModel,
			SCOPE_CONFIG
		);

		try {
			const _f = await restoreEnforcementGroups(form.data._ids);

			if (_f.acknowledged) {
				const log_data: T_Log_C = {
					level: 'INFO',
					type: 'RESTORE',
					message: 'restored enforcement group',
					source: 'enforcement group form action - restore',
					affected_collection: {
						collection_name: 'enforcement_groups',
						document_id: form.data._ids
					},
					user: logActor(locals.user)
				};

				await createLog(log_data);
			}

			return message(form, { type: 'success', text: 'Enforcement groups restored successfully.' });
		} catch (error) {
			if (error) return fail(400, { form });
		}
	},
	//save a group's incentive settings — the defaults the incentives generate form starts from
	incentive: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(EnforcementGroup.IncentiveSchema));

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Some incentive settings need fixing.' },
				{ status: 400 }
			);
		}

		const edit_scope = requireAccess(locals.user, 'incentives', 'edit');
		const existing_group = await EnforcementGroupsModel.findById(form.data._id).lean();
		await assertOwnership(locals.user, edit_scope, existing_group, SCOPE_CONFIG);

		const _old = (existing_group as { incentive?: unknown } | null)?.incentive ?? null;
		const _f = await updateIncentiveSettings(form.data, locals.user!._id);

		// check the settings actually came back saved, rather than trusting the update call
		if (!(_f as { incentive?: unknown } | null)?.incentive) {
			return message(
				form,
				{ type: 'error', text: 'Cannot process your request. Please try again.' },
				{ status: 400 }
			);
		}

		const log_data: T_Log_C = {
			level: 'INFO',
			type: 'EDIT',
			message: 'edited enforcement group incentive settings',
			source: 'enforcement group form action - incentive',
			affected_collection: {
				collection_name: 'enforcement_groups',
				document_id: [form.data._id]
			},
			user: logActor(locals.user),
			metadata: {
				from: _old,
				to: (_f as { incentive?: unknown }).incentive ?? null
			}
		};

		await createLog(log_data);

		return message(form, { type: 'success', text: 'Incentive settings saved.' });
	}
};
