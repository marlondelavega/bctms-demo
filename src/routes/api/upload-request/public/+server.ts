import { json, type RequestHandler } from '@sveltejs/kit';

// The demo has no file service, so photo uploads are switched off. Callers
// (`uploadPhoto`, `uploadFile`) already show a friendly message on a non-ok reply.
export const GET: RequestHandler = async () => {
	return json({}, { status: 503, statusText: 'Photo uploads are disabled in the demo.' });
};
