import { getViolationCategories } from '$lib/server/services/ViolationCategories.service';
import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { requireAccess, scopeFilter } from '$lib/server/utilities/permissions.server';

export async function GET(event: RequestEvent) {
	if (!event.cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const user = event.locals.user;

	const allowed = requireAccess(user, 'violation_categories');

	try {
		const _url = event.url;
		const _q = _url.searchParams;
		const filter = await scopeFilter(user, allowed, { ownField: 'created_by' });

		const categories = await getViolationCategories(_q, filter);

		return json(
			{ data: categories.data },
			{
				status: 200,
				statusText: 'Successfully retrieved violation categories.',
				headers: { 'X-Total-Count': JSON.stringify(categories.total) }
			}
		);
	} catch (error) {
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
