import type { Actions } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { resolve } from '$app/paths';
import ViolatorsModel from '$lib/server/models/Violators.model';
import { getViolator_byId, updateViolator } from '$lib/server/services/Violators.service';
import { redirect } from 'sveltekit-flash-message/server';
import Violator from '$lib/validation_schemas/Violators.zod';
import { requireAccess, assertOwnership } from '$lib/server/utilities/permissions.server';
import { uploadPhoto } from '$lib/server/utilities/upload_photo.server';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';

export const actions: Actions = {
	edit: async ({ request, fetch, cookies, params, locals }) => {
		const form = await superValidate(request, zod4(Violator.EditSchema));

		// a File can't be serialized back to the page, so take it off the form before any return
		const photo = form.data.files;
		form.data.files = undefined;
		// an empty file input arrives as a 0-byte File
		const has_new_photo = !!photo && photo.size > 0;

		if (!form.valid) {
			return message(
				form,
				{ type: 'error', text: 'Some fields need fixing. Check the highlighted fields.' },
				{ status: 400 }
			);
		} else if (!params.id) {
			return message(
				form,
				{ type: 'error', text: 'Violator data is required. Please try again.' },
				{ status: 400 }
			);
		}

		const scope = requireAccess(locals.user, 'violators', 'edit');
		const existing = await ViolatorsModel.findById(params.id).lean();
		await assertOwnership(locals.user, scope, existing, { ownField: 'created_by' });

		form.data.firstname = form.data.firstname.toUpperCase();
		form.data.middlename = form.data.middlename.toUpperCase();
		form.data.lastname = form.data.lastname.toUpperCase();

		const _no_changes =
			!has_new_photo &&
			(await ViolatorsModel.findOne({
				_id: params.id,
				profile_image: form.data.profile_image,
				firstname: form.data.firstname,
				middlename: form.data.middlename,
				lastname: form.data.lastname,
				suffix: form.data.suffix,
				sex: form.data.sex,
				birthdate: form.data.birthdate,
				license_number: form.data.license_number,
				contact_number: form.data.contact_number,
				address_province: form.data.address_province,
				address_city: form.data.address_city,
				address_barangay: form.data.address_barangay,
				address_line: form.data.address_line,
				address_house_number: form.data.address_house_number
			}));

		if (_no_changes) {
			return message(
				form,
				{ type: 'error', text: 'Nothing has changed yet. Edit a field before saving.' },
				{ status: 400 }
			);
		}

		const _found_existing = await ViolatorsModel.findOne({
			_id: { $ne: params.id },
			firstname: form.data.firstname,
			middlename: form.data.middlename,
			lastname: form.data.lastname,
			birthdate: form.data.birthdate
		});

		if (_found_existing) {
			form.errors.lastname = ['A violator with this name and birthdate already exists.'];
			return message(
				form,
				{
					type: 'error',
					text: 'Another violator on record has this name and birthdate.'
				},
				{ status: 400 }
			);
		}

		// uploaded last, so a rejected save never leaves an orphaned photo behind
		if (has_new_photo) {
			const uploaded = await uploadPhoto(fetch, photo);
			if ('error' in uploaded) {
				return message(
					form,
					{
						type: 'error',
						text: `${uploaded.error} Remove the new photo to save the other changes.`
					},
					{ status: 400 }
				);
			}
			form.data.profile_image = uploaded.id;
		}

		const _old = await getViolator_byId(params.id);

		const _u = await updateViolator({ ...form.data, _id: params.id });

		if (!_u) {
			return message(
				form,
				{ type: 'error', text: `Cannot process your request. Please try again.` },
				{ status: 400 }
			);
		}

		const log_data: T_Log_C = {
			level: 'INFO',
			type: 'EDIT',
			message: 'edited violator',
			source: 'violators form action - edit',
			affected_collection: {
				collection_name: 'violators',
				document_id: [_u._id.toString()]
			},
			user: logActor(locals.user),
			metadata: {
				from: _old,
				to: _u
			}
		};

		await createLog(log_data);

		redirect(
			resolve('/u/violators?page=1&size=10'),
			{ type: 'success', message: `${_u.firstname} ${_u.lastname}'s profile was updated.` },
			cookies
		);
	}
};
