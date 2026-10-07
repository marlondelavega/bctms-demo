import { error } from '@sveltejs/kit';
import EnforcementGroupsModel from '$lib/server/models/EnforcementGroups.model';
import { listIncentiveReports } from '$lib/server/services/Incentives.service';
import { multiParam } from '$lib/utilities/helper';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) error(401, 'Access denied');

	const [list, groups] = await Promise.all([
		listIncentiveReports(locals.user, url.searchParams),
		EnforcementGroupsModel.find({ archived: { $ne: true } }, { name: 1 })
			.sort({ name: 1 })
			.lean()
	]);

	return {
		list,
		groups: JSON.parse(JSON.stringify(groups)) as { _id: string; name: string }[],
		applied: {
			search: url.searchParams.get('search') ?? '',
			date_from: url.searchParams.get('date_from') ?? '',
			date_to: url.searchParams.get('date_to') ?? '',
			status: multiParam(url.searchParams, 'status'),
			enforcement_group: multiParam(url.searchParams, 'enforcement_group')
		}
	};
};
