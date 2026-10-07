import { loadFlash } from 'sveltekit-flash-message/server';
import { isDemoMode } from '$lib/server/demo/guards';

export const load = loadFlash(async () => {
	return { demo: isDemoMode() };
});
