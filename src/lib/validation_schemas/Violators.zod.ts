/* eslint-disable @typescript-eslint/no-namespace */
import z from 'zod/v4';
import { ImageFileSchema } from './FileUpload.zod';

namespace Violator {
	// schemas
	export const Schema = z.object({
		_id: z.string().nonempty(),
		files: ImageFileSchema.optional(),
		profile_image: z.string().optional(),
		firstname: z.string('Firstname must be a string.').nonempty('Firstname is required.'),
		middlename: z.string('Middlename must be a string.'),
		lastname: z.string('Lastname must be a string.').nonempty('Lastname is required.'),
		suffix: z.string('Suffix must be a string'),
		sex: z.preprocess(
			(val) => (val === null ? undefined : val),
			z.enum(['male', 'female'], { error: 'Sex is required.' })
		),
		birthdate: z.preprocess(
			(val) => (val === null || val === '' ? undefined : val),
			z.coerce
				.date({ error: 'Birthdate is required.' })
				.min(new Date('1900-01-01'), { error: 'Birthdate is not valid.' })
				// evaluated per parse; a static `.max(new Date())` would freeze at server start
				.refine((d) => d <= new Date(), { error: 'Birthdate cannot be in the future.' })
		),

		license_number: z.string(),
		contact_number: z
			.string()
			.regex(/^[^a-zA-Z]*$/, 'Use digits only.')
			.nullish()
			.superRefine((data, ctx) => {
				if (!data) return;

				if (!data.startsWith('+63')) {
					ctx.addIssue({
						code: 'custom',
						message: 'Mobile numbers start with +63.'
					});
				}

				if (data.length !== 13) {
					ctx.addIssue({
						code: 'custom',
						message: 'Enter the 10 digits after +63, e.g. 912 345 6789.'
					});
				}
			}),
		address_province: z
			.string('Province must be a string.')
			.nonempty('Province is required.')
			.regex(/^[a-zA-Z0-9À-ÿ\s,.\-#/]+$/, 'Address contains invalid characters'),
		address_city: z
			.string('City must be a string.')
			.nonempty('City is required.')
			.regex(/^[a-zA-Z0-9À-ÿ\s,.\-#/]+$/, 'Address contains invalid characters'),
		address_barangay: z
			.string('Barangay must be a string.')
			.nonempty('Barangay is required.')
			.regex(/^[a-zA-Z0-9À-ÿ\s,.\-#/]+$/, 'Address contains invalid characters'),
		address_line: z.string('Address must be a string.'),
		address_house_number: z.number('House number must be a number.').nullish(),
		archived: z.boolean(),
		legacy_profile_image: z.string().nullish()
	});
	export const CreateSchema = Schema.omit({ _id: true, archived: true });
	export const EditSchema = Schema.omit({ archived: true });
	export const ArchiveSchema = z.object({
		_ids: z.array(z.string())
	});

	// types
	export type Create = z.infer<typeof CreateSchema>;
	export type Edit = z.infer<typeof EditSchema>;
	export type Archive = z.infer<typeof ArchiveSchema>;
	export type Restore = z.infer<typeof ArchiveSchema>;
	export type Base = {
		_id: string;
		profile_image: string;
		firstname: string;
		middlename?: string;
		lastname: string;
		suffix?: string;
		sex: 'male' | 'female';
		birthdate: string;
		license_number?: string;
		contact_number?: number;
		address_province: string;
		address_city: string;
		address_barangay: string;
		address_line?: string;
		address_house_number?: string;
		archived: boolean;
	};
}

export default Violator;
