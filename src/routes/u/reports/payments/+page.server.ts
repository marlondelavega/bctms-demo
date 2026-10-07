import { error } from '@sveltejs/kit';
import {
	appliedFilters,
	getPaymentReport,
	getReportFilterOptions,
	PAYMENT_MULTI_FILTERS
} from '$lib/server/services/Reports.service';
import { date } from '$lib/utilities/helper';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) error(401, 'Access denied');

	const params = new URLSearchParams(url.searchParams);

	if (!params.get('date_from') && !params.get('date_to')) {
		const now = new Date();
		params.set('date_from', date.dateToString(new Date(now.getFullYear(), now.getMonth(), 1)));
		params.set('date_to', date.dateToString(now));
	}

	const [report, filter_options] = await Promise.all([
		getPaymentReport(locals.user, params),
		getReportFilterOptions()
	]);

	return { report, filter_options, applied: appliedFilters(params, PAYMENT_MULTI_FILTERS) };
};
