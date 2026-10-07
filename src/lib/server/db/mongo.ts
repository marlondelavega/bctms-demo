import { MONGO_URL, NODE_ENV } from '$env/static/private';
import mongoose from 'mongoose';
import { prepareIncentives } from './incentives_setup';

const options = {
	autoIndex: NODE_ENV !== 'production',
	bufferCommands: true,
	maxPoolSize: 100
};

let connectionPromise: Promise<typeof mongoose> | null = null;
let startupPromise: Promise<void> | null = null;

/** One-time startup work: build/backfill what the incentives module needs. */
function runStartup() {
	startupPromise ??= (async () => {
		await prepareIncentives();
	})().catch((err) => {
		startupPromise = null; // let the next call retry
		throw err;
	});
	return startupPromise;
}

export async function connectDB() {
	// mongoose's connection outlives a dev-server reload of this module, so the startup work is
	// keyed to this module instance rather than to opening the connection — otherwise a reload
	// with the connection still open would skip it
	if (mongoose.connection.readyState === 1) {
		await runStartup();
		return mongoose;
	}

	// Connection in progress — reuse the same promise
	if (connectionPromise) return connectionPromise;

	console.log('Starting CiteTicket server');
	connectionPromise = mongoose.connect(MONGO_URL, options).catch((err) => {
		connectionPromise = null; // reset on failure so it can retry
		throw err;
	});

	await connectionPromise;
	await runStartup();
	return connectionPromise;
}
