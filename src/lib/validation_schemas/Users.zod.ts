/* eslint-disable @typescript-eslint/no-namespace */
import z from 'zod/v4';
import { ImageFileSchema } from './FileUpload.zod';
import type EnforcementGroup from './EnforcementGroups.zod';
import type UserType from './UserTypes.zod';

namespace User {
	// schemas
	export const Schema = z.object({
		_id: z.string().nonempty(),
		files: ImageFileSchema.optional(),
		profile_image: z.string().optional(),
		enforcement_group: z.string().nonempty('Please select which enforcement group to assign.'),
		user_type: z.string().nonempty('Please select the type of user.'),
		username: z.string().nonempty('Username is required.'),
		firstname: z
			.string()
			.nonempty('Firstname is required.')
			.regex(/[a-zA-Z]/, 'Firstname must contain at least 1 letter (a-z).'),
		middlename: z.string().optional(),
		lastname: z
			.string()
			.nonempty('Lastname is required.')
			.regex(/[a-zA-Z]/, 'Lastname must contain at least 1 letter (a-z).'),
		password: z
			.string()
			.nonempty('Password is required.')
			.min(6, 'Password must contain at least 6 characters.')
			.regex(/[a-zA-Z]/, 'Password must contain at least 1 letter (a-z).'),
		archived: z.boolean()
	});
	export const CreateSchema = Schema.omit({ _id: true, archived: true, password: true });
	export const EditSchema = Schema.omit({ password: true, archived: true });
	export const ArchiveSchema = z.object({
		_ids: z.array(z.string())
	});
	export const ResetPasswordSchema = z.object({
		_id: z.string().nonempty('User is required.')
	});

	// types
	export type Create = z.infer<typeof CreateSchema>;
	export type Edit = z.infer<typeof EditSchema>;
	export type Archive = z.infer<typeof ArchiveSchema>;
	export type Restore = z.infer<typeof ArchiveSchema>;
	export type ResetPassword = z.infer<typeof ResetPasswordSchema>;
	export type Base<T = string | EnforcementGroup.Base, K = string | UserType.Base> = {
		_id: string;
		profile_image: string;
		enforcement_group: T; // enforcement group ref
		user_type: K; // user type ref
		username: string;
		firstname: string;
		middlename?: string;
		lastname: string;
		password: string;
		archived: boolean;
		password_change: boolean;
		/** newest session's creation time; only set by the users list query */
		last_login?: Date | string | null;
	};
}

export default User;
