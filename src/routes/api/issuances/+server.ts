import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getIssuances } from '$lib/server/services/Issuances.service';
import { requireAccess, scopeFilter } from '$lib/server/utilities/permissions.server';

export async function GET(event: RequestEvent) {
	if (!event.cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}
	const user = event.locals.user;

	const allowed = requireAccess(user, 'issuance');

	try {
		//try to execute

		const _url = event.url;
		const _q = _url.searchParams;
		const filter = await scopeFilter(user, allowed, { ownField: 'issuer' });

		const issuances = await getIssuances(_q, filter);

		return json(
			//response body
			{ data: issuances.data },

			//response status
			{
				status: 200,
				statusText: issuances.data.length
					? 'Successfully retrieved tickets assignments'
					: 'No ticket assignments found',

				//custom headers
				headers: {
					//use custom X-Total-Count header to send total count _c
					'X-Total-Count': JSON.stringify(issuances.total)
				}
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
