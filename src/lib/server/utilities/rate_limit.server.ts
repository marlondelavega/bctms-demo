/**
 * Small in-memory fixed-window rate limiter. State lives in this process only, so it resets on a
 * restart and is not shared between instances. That is enough to slow password guessing on a
 * single Node server; put a shared store behind it if the app is ever scaled out.
 */
type Bucket = { count: number; reset_at: number };

const buckets = new Map<string, Bucket>();
let last_sweep = 0;

function sweep(now: number) {
	if (now - last_sweep < 60_000) return;
	last_sweep = now;
	for (const [key, b] of buckets) if (b.reset_at <= now) buckets.delete(key);
}

/** Seconds until `key` may try again, or 0 if it is under its limit. Does not count an attempt. */
export function retryAfter(key: string, limit: number): number {
	const now = Date.now();
	sweep(now);
	const b = buckets.get(key);
	if (!b || b.reset_at <= now || b.count < limit) return 0;
	return Math.ceil((b.reset_at - now) / 1000);
}

/** Counts one attempt against `key` for `window_ms`. */
export function recordHit(key: string, window_ms: number) {
	const now = Date.now();
	const b = buckets.get(key);
	if (!b || b.reset_at <= now) buckets.set(key, { count: 1, reset_at: now + window_ms });
	else b.count++;
}

export function clearKey(key: string) {
	buckets.delete(key);
}

export const minutesLabel = (seconds: number) => {
	const m = Math.max(1, Math.ceil(seconds / 60));
	return m === 1 ? '1 minute' : `${m} minutes`;
};
