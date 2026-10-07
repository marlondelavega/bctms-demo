import { dev } from '$app/environment';
import { resolve } from '$app/paths';

/**
 * Sends a profile photo to the file service.
 * Returns the stored file's id, or the message to show when the upload fails.
 */
export async function uploadPhoto(
	fetch: typeof globalThis.fetch,
	photo: File
): Promise<{ id: string } | { error: string }> {
	const files = new FormData();
	files.append('files', photo);

	// ask for a signed upload url first, then upload to it
	const upload_req = await fetch(resolve('/api/upload-request/public'));
	if (!upload_req.ok) return { error: 'The photo upload service is unavailable.' };

	const upload_url: string = (await upload_req.json()).data.data.url;
	// in dev the upload goes through the vite proxy, so only the path is used
	const upload = await fetch(dev ? new URL(upload_url).pathname : upload_url, {
		method: 'POST',
		body: files
	});
	if (!upload.ok) return { error: 'The photo could not be uploaded.' };

	return { id: (await upload.json()).data.files[0]._id };
}
