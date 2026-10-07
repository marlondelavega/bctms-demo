import { error } from '@sveltejs/kit';
import { getLogs, multiParam } from '$lib/server/services/Logs.service';
import { log_levels, log_types } from '$lib/server/models/Logs.model';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) error(401, 'Access denied');

	const logs = await getLogs(locals.user, url.searchParams);

	return {
		logs,
		levels: Object.values(log_levels),
		types: Object.values(log_types),
		applied: {
			search: url.searchParams.get('search') ?? '',
			size: url.searchParams.get('size') ?? '10',
			date_from: url.searchParams.get('date_from') ?? '',
			date_to: url.searchParams.get('date_to') ?? '',
			level: multiParam(url.searchParams, 'level'),
			type: multiParam(url.searchParams, 'type'),
			collection: multiParam(url.searchParams, 'collection')
		}
	};
};
