import { getCodeProvisions_byCategory } from '$lib/server/services/CodeProvisions.service';
import { error, json } from '@sveltejs/kit';

export async function GET({ cookies }) {
	if (!cookies.get('bctms_auth_session')) {
		error(403, 'Forbidden');
	}

	try {
		//try to execute

		//find code provision by id
		const provision = await getCodeProvisions_byCategory();

		//return a http response using sveltekit json() response
		return json(
			//response body
			{ data: provision },

			//response status
			{
				status: 200,
				statusText: 'Successfully retrieved code provisions'
			}
		);
	} catch (error) {
		//catches thrown errors
		return json({}, { status: 400, statusText: JSON.stringify(error) });
	}
}
