import type { Snippet } from 'svelte';

/* eslint-disable @typescript-eslint/no-namespace */
namespace Permission {
	export type Props = {
		children: Snippet;
		action: (typeof Actions)[keyof typeof Actions];
		permissions: string[];
		route: string;
		fallback?: Snippet;
	};

	export enum Actions {
		ACCESS = 'access',
		CREATE = 'create',
		EDIT = 'edit',
		ARCHIVE = 'archive',
		RESTORE = 'restore'
	}
}

export default Permission;
