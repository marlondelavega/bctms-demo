<script lang="ts">
	import { getPreviewUrl } from '$lib/utilities/helper';
	import {
		ALLOWED_IMAGE_TYPES,
		MAX_IMAGE_SIZE_BYTES
	} from '$lib/validation_schemas/FileUpload.zod';
	import { ImagePlus, RefreshCw, X } from '@lucide/svelte';

	let {
		files = $bindable(),
		name,
		error = $bindable(),
		current,
		current_src,
		fallback,
		label = 'Profile photo',
		layout = 'wide'
	}: {
		files: FileList | null;
		name: string;
		error?: string | null;
		/** id of the photo already on record; shown until a new one is picked */
		current?: string;
		/** full url of a photo on record that is not in the file service (e.g. a legacy import); used when `current` is empty */
		current_src?: string;
		/** shown in place of a photo when there is none, e.g. the person's initial */
		fallback?: string;
		label?: string;
		/** `wide` is a full-width strip; `fill` stretches to the height of its container, for a photo column beside a form */
		layout?: 'wide' | 'fill';
	} = $props();

	const uid = $props.id();

	let input: HTMLInputElement;
	let dragging = $state(false);
	// the id of a stored photo that failed to load; a different record's photo is tried afresh
	let failed_current = $state<string | null>(null);

	const picked = $derived(files?.length ? files[0] : null);
	const preview_url = $derived(picked ? URL.createObjectURL(picked) : null);

	$effect(() => {
		const url = preview_url;
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	// a cleared `files` must also empty the input, or the old file is still submitted with the form
	$effect(() => {
		if (!files?.length && input?.files?.length) input.value = '';
	});

	const problemWith = (list: FileList | null | undefined): string | null => {
		if (!list?.length) return 'No file found. Drop a single image.';
		if (list.length > 1) return 'Drop one image at a time.';
		if (!ALLOWED_IMAGE_TYPES.includes(list[0].type)) return 'Use a JPEG, PNG or WebP image.';
		if (list[0].size > MAX_IMAGE_SIZE_BYTES) return 'That image is larger than 10 MB.';
		return null;
	};

	const accept = (list: FileList | null | undefined) => {
		const problem = problemWith(list);
		if (problem) {
			error = problem;
			// keep the earlier good pick, if any, rather than submitting the rejected one
			if (files?.length) input.files = files;
			else input.value = '';
			return;
		}
		error = null;
		input.files = list as FileList;
		files = list as FileList;
	};

	const remove = () => {
		files = null;
		error = null;
		input.value = '';
	};

	const formatSize = (bytes: number) =>
		bytes < 1024 * 1024
			? `${Math.max(1, Math.round(bytes / 1024))} KB`
			: `${(bytes / 1024 / 1024).toFixed(1)} MB`;

	const current_url = $derived(current ? getPreviewUrl() + current : current_src || undefined);
	const showing_current = $derived(!picked && !!current_url && failed_current !== current_url);
</script>

<svelte:window ondragover={(e) => e.preventDefault()} ondrop={(e) => e.preventDefault()} />

<!-- min-w-0: a fieldset won't shrink below its content by default, so a long file name would push it out of its column -->
<fieldset class={['fieldset w-full min-w-0', layout === 'fill' && 'flex h-full flex-col']}>
	<legend class="fieldset-legend">{label}</legend>

	<div class={['relative', layout === 'fill' && 'flex min-h-0 grow flex-col']}>
		<label
			for={uid}
			class={[
				'group relative flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-box border transition-colors',
				'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-primary',
				layout === 'fill' ? 'min-h-64 grow' : 'h-40',
				picked || showing_current
					? 'border-base-300 bg-base-200'
					: 'border-dashed border-base-content/30 hover:border-primary hover:bg-primary/5',
				dragging && 'border-primary! bg-primary/5'
			]}
			ondragenter={() => (dragging = true)}
			ondragover={(e) => e.preventDefault()}
			ondragleave={(e) => {
				if (!e.currentTarget.contains(e.relatedTarget as Node)) dragging = false;
			}}
			ondrop={(e) => {
				e.preventDefault();
				dragging = false;
				accept(e.dataTransfer?.files);
			}}
		>
			{#if picked && preview_url}
				<img src={preview_url} alt="Selected" class="absolute inset-0 size-full object-cover" />
			{:else if showing_current}
				<img
					src={current_url}
					alt="Current"
					class="absolute inset-0 size-full object-cover"
					onerror={() => (failed_current = current_url ?? null)}
				/>
			{:else}
				<div class="flex flex-col items-center gap-1 px-4 text-center">
					{#if fallback && layout === 'fill'}
						<span
							class="mask mb-2 flex size-14 items-center justify-center bg-secondary/30 text-xl font-semibold mask-squircle"
							aria-hidden="true">{fallback}</span
						>
					{:else}
						<ImagePlus
							class="mb-2 size-6 text-base-content/70 transition-colors group-hover:text-primary"
						/>
					{/if}
					<p class="text-sm transition-colors group-hover:text-primary">
						Drop a photo or <span class="underline underline-offset-2">browse</span>
					</p>
					<p class="text-xs text-base-content/60">JPEG, PNG or WebP, up to 10 MB</p>
				</div>
			{/if}

			{#if picked || showing_current}
				<span
					class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-base-100/85 py-1.5 text-xs font-medium opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-has-[input:focus-visible]:opacity-100"
				>
					<RefreshCw class="size-3" /> Replace
				</span>
			{/if}

			<input
				bind:this={input}
				type="file"
				class="sr-only"
				id={uid}
				{name}
				accept={ALLOWED_IMAGE_TYPES.join(',')}
				onchange={(e) => {
					const list = e.currentTarget.files;
					if (list?.length) accept(list);
					else remove();
				}}
			/>
		</label>

		{#if picked}
			<button
				type="button"
				class="btn absolute top-2 right-2 btn-circle border-base-300 bg-base-100/90 shadow-sm btn-xs"
				aria-label="Remove the selected photo"
				title="Remove"
				onclick={remove}
			>
				<X class="size-3.5" />
			</button>
		{/if}
	</div>

	{#if error}
		<p class="text-xs text-error" role="alert">{error}</p>
	{:else if picked}
		<p class="truncate text-xs text-base-content/70" title={picked.name}>
			{current_url ? 'Replaces the current photo when saved' : picked.name} · {formatSize(
				picked.size
			)}
		</p>
	{:else if showing_current}
		<p class="text-xs text-base-content/60">Drop or browse to replace</p>
	{:else}
		<p class="h-4"></p>
	{/if}
</fieldset>
