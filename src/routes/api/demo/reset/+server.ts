import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { isDemoMode } from '$lib/server/demo/guards';

// Nightly reset: a scheduler (cron job, GitHub Actions, the host's cron) POSTs here with the
// shared token and the demo database is wiped and re-seeded. Only exists in demo mode.
let running = false;
let last_run: { started: Date; finished?: Date; error?: string } | null = null;

function tokenMatches(header: string | null) {
	const expected = env.DEMO_RESET_TOKEN ?? '';
	if (expected.length < 16) return false; // an unset or trivially short token disables the endpoint
	const given = Buffer.from(header?.replace(/^Bearer\s+/i, '') ?? '');
	const wanted = Buffer.from(expected);
	return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export const POST: RequestHandler = async ({ request }) => {
	if (!isDemoMode()) error(404, 'Not found');
	if (!tokenMatches(request.headers.get('authorization'))) error(401, 'Unauthorized');
	if (running) return json({ status: 'already running' }, { status: 409 });

	running = true;
	last_run = { started: new Date() };
	// seeding takes a while, so answer straight away and let it finish in the background
	import('$lib/server/scripts/seed/seed')
		.then(({ runSeed }) => runSeed())
		.then(() => {
			last_run = { ...last_run!, finished: new Date() };
		})
		.catch((err) => {
			console.error('Demo reset failed', err);
			last_run = { ...last_run!, finished: new Date(), error: String(err?.message ?? err) };
		})
		.finally(() => {
			running = false;
		});

	return json({ status: 'started' }, { status: 202 });
};

export const GET: RequestHandler = async ({ request }) => {
	if (!isDemoMode()) error(404, 'Not found');
	if (!tokenMatches(request.headers.get('authorization'))) error(401, 'Unauthorized');
	return json({ running, last_run });
};
