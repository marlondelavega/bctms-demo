import { error } from '@sveltejs/kit';
import { DashboardService } from '$lib/server/services/Dashboard.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) error(401, 'Access denied');

	return { dashboard: await DashboardService.get_dashboard(locals.user) };
};
