// import { permissions } from '$lib/utilities/helper';
// import { error, json } from '@sveltejs/kit';
// import type { RequestEvent } from './$types';

// export async function GET(event: RequestEvent) {
// 	if (!event.cookies.get('bctms_auth_session')) {
// 		error(403, 'Forbidden');
// 	}
// 	const user = event.locals.user;

// 	if (!permissions.hasAccess('users', user?.user_type.permissions as string[])) {
// 		throw error(401, 'Access denied');
// 	}

// 	const allowed = permissions.get('users', user.user_type.permissions).access;

// 	try {
// 		const _url = event.url;
// 		const _q = _url.searchParams;

// 		if (allowed == 'no') {
// 			return json(
// 				{ data: [] },
// 				{
// 					status: 401,
// 					statusText: 'No necessary permissions to access this data.',
// 					headers: {
// 						'X-Total-Count': '0'
// 					}
// 				}
// 			);
// 		}

// 		if (!_q.get('username') || _q.get('username') == null) {
// 			return json(
// 				{ data: false },
// 				{
// 					status: 200,
// 					statusText: 'Please provide a username.'
// 				}
// 			);
// 		}

// 		const username = _q.get('username') as string;

// 		const valid_username = await checkUsername(username);
// 		if (!valid_username) {
// 			return json(
// 				{ data: valid_username },
// 				{
// 					status: 400,
// 					statusText: 'Username is unavailable'
// 				}
// 			);
// 		}

// 		//return a http response using sveltekit json() response
// 		return json(
// 			{ data: valid_username },
// 			{
// 				status: 200,
// 				statusText: 'Username is available'
// 			}
// 		);
// 	} catch (error) {
// 		//catches thrown errors
// 		return json({}, { status: 400, statusText: JSON.stringify(error) });
// 	}
// }
