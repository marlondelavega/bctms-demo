import mongoose from 'mongoose';

/**
 * Removes a previously registered model so the `mongoose.models.x || mongoose.model('x', schema)`
 * line that follows compiles the *current* schema.
 *
 * Without this, a dev server that reloads an edited model file keeps the model compiled from the
 * old schema, and strict mode then silently drops writes to any newly added path (a save reports
 * success but stores nothing). In production each model file runs once, so there is nothing to
 * remove and this does nothing.
 */
export function dropStaleModel(name: string) {
	if (mongoose.models[name]) mongoose.deleteModel(name);
}
