import { SESSION_SECRET } from '$env/static/private';
import crypto from 'crypto';

export type SessionPayload = {
	/** id of the `sessions` document; the user is resolved from it server-side */
	sid: string;
	/** absolute expiry (ms epoch) — a cheap pre-check, the sessions doc is authoritative */
	exp: number;
};

function sign(data: string): string {
	return crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
}

/** Builds a tamper-evident session token: base64url(payload) + '.' + HMAC signature. */
export function createSessionToken(payload: SessionPayload): string {
	const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
	return `${data}.${sign(data)}`;
}

/** Verifies the signature and returns the payload, or null if missing/malformed/tampered. */
export function verifySessionToken(token: string): SessionPayload | null {
	const [data, signature] = token.split('.');
	if (!data || !signature) return null;

	const expected = Buffer.from(sign(data));
	const actual = Buffer.from(signature);
	if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
		return null;
	}

	try {
		const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
		if (typeof payload?.sid !== 'string' || typeof payload?.exp !== 'number') return null;
		return payload;
	} catch {
		return null;
	}
}
