// Entry point for `npm run seed`. Boots a Vite SSR loader so the seed can use the app's own
// services (they rely on `$lib`, `$env` and TypeScript), after checking that this really is a demo
// database. It wipes every collection, so the guards run before anything else is loaded.
import { createServer, loadEnv } from 'vite';

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };

if (env.DEMO_MODE !== 'true') {
	console.error('Refusing to seed: set DEMO_MODE=true to confirm this is a demo environment.');
	process.exit(1);
}

const url = env.MONGO_URL ?? '';
const db_name = (url.split('?')[0].split('/').pop() ?? '').trim();
if (!db_name || !/demo/i.test(db_name) || /^bctms$/i.test(db_name)) {
	console.error(
		`Refusing to seed: the database in MONGO_URL ("${db_name || 'none given'}") must be named like "citeticket_demo". This script deletes everything in it.`
	);
	process.exit(1);
}

const vite = await createServer({
	configFile: 'vite.config.ts',
	server: { middlewareMode: true },
	appType: 'custom',
	logLevel: 'error'
});

let failed = false;
try {
	const { runSeed } = await vite.ssrLoadModule('/src/lib/server/scripts/seed/seed.ts');
	await runSeed();
} catch (err) {
	failed = true;
	console.error(err);
} finally {
	await vite.close();
	const mongoose = (await import('mongoose')).default;
	await mongoose.disconnect().catch(() => undefined);
}
process.exit(failed ? 1 : 0);
