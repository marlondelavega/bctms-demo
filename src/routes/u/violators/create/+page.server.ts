import { message, superValidate } from 'sveltekit-superforms';
import type { Actions, PageServerLoad } from './$types';
import { zod4 } from 'sveltekit-superforms/adapters';
import { createViolator } from '$lib/server/services/Violators.service';
import { permissions } from '$lib/utilities/helper';
import { requireAccess } from '$lib/server/utilities/permissions.server';
import { uploadPhoto } from '$lib/server/utilities/upload_photo.server';
import Violator from '$lib/validation_schemas/Violators.zod';
import type { T_Log_C } from '$lib/server/models/Logs.model';
import { createLog, logActor } from '$lib/server/services/Logs.service';
import ViolatorsModel from '$lib/server/models/Violators.model';
import { lgu } from '$lib/data/lgu';

// most violators are apprehended in the LGU's own city, so the address starts there; superforms resets to these after each add
const ADDRESS_DEFAULTS = { address_province: lgu.province, address_city: lgu.city };

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();
	const form = await superValidate(ADDRESS_DEFAULTS, zod4(Violator.CreateSchema), {
		errors: false
	});

	if (permissions.get('violators', user?.user_type.permissions as string[]).access == 'none') {
		return {
			form,
			authorized: false,
			message: 'You do not meet the necessary permission to view data.'
		};
	}
	return { form, authorized: true, message: '' };
};

export const actions: Actions = {
	create: async ({ request, fetch, locals }) => {
		const form = await superValidate(request, zod4(Violator.CreateSchema));

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

		requireAccess(locals.user, 'violators', 'create');

		form.data.firstname = form.data.firstname.toUpperCase();
		form.data.middlename = form.data.middlename.toUpperCase();
		form.data.lastname = form.data.lastname.toUpperCase();

		const _found_existing = await ViolatorsModel.findOne({
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
					text: 'This violator is already on record. Search the violators list instead of adding them again.'
				},
				{ status: 400 }
			);
		}

		// an empty file input arrives as a 0-byte File
		if (photo && photo.size > 0) {
			const uploaded = await uploadPhoto(fetch, photo);
			if ('error' in uploaded) {
				return message(
					form,
					{
						type: 'error',
						text: `${uploaded.error} Remove the photo to add this violator without one.`
					},
					{ status: 400 }
				);
			}
			form.data.profile_image = uploaded.id;
		}

		const _f = await createViolator(form.data, locals.user);

		if (_f) {
			const log_data: T_Log_C = {
				level: 'INFO',
				type: 'CREATE',
				message: 'created violator',
				source: 'violators form action - create',
				affected_collection: {
					collection_name: 'violators',
					document_id: [_f._id.toString()]
				},
				user: logActor(locals.user)
			};

			await createLog(log_data);
		}

		return message(form, {
			type: 'success',
			text: `${form.data.firstname} ${form.data.lastname} was added to the violators list.`
		});
	}
};
