/* eslint-disable @typescript-eslint/no-namespace */
import z from 'zod/v4';

namespace Login {
	// schemas
	export const Schema = z.object({
		username: z.string().nonempty('Username is required.'),
		// Deliberately no strength rules here: login must accept any existing (incl. legacy) password
		// without revealing the policy. Strength is enforced when a password is set/changed.
		password: z
			.string()
			.nonempty('Password is required.')
			.max(128, 'Incorrect username or password.')
	});

	export const ChangePasswordSchema = z
		.object({
			current_password: z.string().nonempty('Current password is required'),
			new_password: z
				.string()
				.min(8, 'New password must be at least 8 characters')
				.max(128, 'New password is too long'),
			confirm_password: z.string().nonempty('Please confirm your new password')
		})
		.superRefine((data, ctx) => {
			if (data.new_password !== data.confirm_password) {
				ctx.addIssue({
					code: 'custom',
					message: 'Passwords do not match',
					path: ['confirm_password']
				});
			}
			if (data.new_password === data.current_password) {
				ctx.addIssue({
					code: 'custom',
					message: 'New password must be different from your current password',
					path: ['new_password']
				});
			}
		});

	export type ChangePassword = z.infer<typeof ChangePasswordSchema>;

	// types
	export type Credentials = z.infer<typeof Schema>;
}

export default Login;
