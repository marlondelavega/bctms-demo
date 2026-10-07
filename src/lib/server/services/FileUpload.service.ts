import { dev } from '$app/environment';

export async function uploadFile(_files: File | undefined): Promise<Response> {
	if (_files) {
		// set a new form data constructor for files
		const files = new FormData();
		let _final_url = '';

		// add/append the file from form.data on the files formData --i know it's a lot of forms
		files.append('files', _files);

		// fetch the file upload url --we are not uplaoding here, we are still getting/fetching the upload url which will be used for the actual upload
		const upload_req = await fetch('/api/upload-request/public');

		// if the fetch was ok: you may enter
		if (upload_req.ok) {
			const upload_request_fetch_response = await upload_req.json();

			// check if environment is in dev or not
			// if in dev use the URL.pathname, if not use the whole url god dammit
			if (dev) {
				const _url = new URL(upload_request_fetch_response.data.data.url);
				_final_url = _url.pathname;
			} else {
				_final_url = upload_request_fetch_response.data.data.url;
			}

			// if upload not ok, huhu, return a superforms error message
		} else if (!upload_req.ok) {
			return new Response(null, {
				status: 400,
				statusText:
					'File upload service unavailable. You may create this user without a profile image.'
			});
		}

		const upload = await fetch(`${_final_url}`, {
			method: 'POST',
			body: files
		});

		if (!upload.ok) {
			return new Response(null, {
				status: 400,
				statusText:
					'File upload service unavailable. You may create this user without a profile image.'
			});
		}

		const _u = await upload.json();

		return new Response(_u.data.files[0]._id);
	}

	return new Response(null, {
		status: 400,
		statusText: "Can't upload file for now. Try again later."
	});
}
