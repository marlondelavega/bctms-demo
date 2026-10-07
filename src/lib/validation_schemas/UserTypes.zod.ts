/* eslint-disable @typescript-eslint/no-namespace */
import { z } from 'zod/v4';

namespace UserType {
	// schemas
	export const Schema = z.object({
		_id: z.string().nonempty(),
		user_type: z
			.string()
			.nonempty('User type is required.')
			.regex(/[a-zA-Z]/, 'Name must contain at least 1 letter (a-z).'),
		role: z.string().nonempty('Role is required.'),
		permissions: z.array(z.string()),
		access_level: z.number().int().default(5),
		archived: z.boolean()
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
		user_type: string;
		role: string;
		permissions: string[];
		access_level: number;
		date_created: Date;
		archived: boolean;
	};
}

export default UserType;
