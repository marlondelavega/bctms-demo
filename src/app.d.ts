/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { EnforcementGroup } from '$lib/validation_schemas/EnforcementGroups.zod';
import type { User } from '$lib/validation_schemas/Users.zod';
import type { UserType } from '$lib/validation_schemas/UserTypes.zod';

declare namespace NodeJS {
	interface Global {
		mongoose: {
			conn: any; // Or use mongoose.Connection
			promise: Promise<any>; // Or use Promise<mongoose.Mongoose>
		} | null;
	}
}
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: User<EnforcementGroup, UserType>;
			session_id?: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
		namespace Superforms {
			type Message = {
				type: 'error' | 'success' | 'action';
				text: string;
				data?: unknown;
			};
		}
		interface PageData {
			flash?: { type?: 'success' | 'error'; message: string };
		}

		namespace Dev {
			type SvelteFetch = typeof fetch;
		}
	}
}

export {};
