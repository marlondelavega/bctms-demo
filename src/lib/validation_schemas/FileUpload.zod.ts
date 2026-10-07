import z from 'zod/v4';

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// An empty file input arrives as a 0-byte File, so size 0 is let through for the route to treat as "no upload".
export const ImageFileSchema = z
	.instanceof(File, { error: 'Please upload a file.' })
	.refine((f) => f.size <= MAX_IMAGE_SIZE_BYTES, 'Max 10 MB upload size.')
	.refine(
		(f) => f.size === 0 || ALLOWED_IMAGE_TYPES.includes(f.type),
		'Only JPEG, PNG or WebP images are allowed.'
	);

export const FileUpload_Schema = z.object({
	files: ImageFileSchema.optional()
});
