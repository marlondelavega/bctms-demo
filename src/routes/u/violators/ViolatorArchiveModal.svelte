<script lang="ts">
	import type Violator from '$lib/validation_schemas/Violators.zod';
	import { ArchiveX, X } from '@lucide/svelte';
	import { toast, Toaster } from 'svelte-sonner';
	import type { SuperForm } from 'sveltekit-superforms';

	let {
		superform,
		archive_data
	}: {
		superform: SuperForm<Violator.Archive, App.Superforms.Message>;
		archive_data: Violator.Base[];
	} = $props();

	let { form, enhance, delayed, message } = superform;

	let dialog: HTMLDialogElement;

	message.subscribe((m) => {
		if (m) {
			if (m.type == 'error') {
				toast.error(m.text);
			} else if (m.type == 'success') {
				toast.success(m.text);
			}
		}
	});

	$effect(() => {
		if (archive_data) {
			let _ids = archive_data.map((d) => d._id);

			$form._ids = _ids;
		}
	});
</script>

<dialog id="violators_archive" class="modal p-2 backdrop-blur-xs" bind:this={dialog}>
	<Toaster position="top-center" richColors />

	<div class="relative modal-box flex w-full flex-col gap-4 md:w-5/12">
		<div class="flex flex-row items-center gap-4">
			<ArchiveX class=" size-6 stroke-error" />

			<h3 class="font-bold text-error">
				Archive Violator{archive_data.length > 1 ? 's' : ''}?
			</h3>
		</div>

		<form method="POST" action="?/archive" use:enhance novalidate>
			<input type="hidden" name="_ids" value={$form._ids} />

			<div class="mb-4 flex flex-col gap-2 text-xs">
				{#if archive_data.length > 1}
					<p>
						Archiving these Violators will remove them from standard views but they will remain
						fully accessible.
					</p>

					<p>You can filter for archived items and restore them at any time.</p>
				{:else}
					<p>
						Archiving this Violator will remove it from standard views but they will remain fully
						accessible.
					</p>

					<p>You can filter for archived items and restore them at any time.</p>
				{/if}
			</div>

			<div class="modal-action mt-0">
				<button class="btn btn-ghost" type="button" onclick={() => dialog.close()}>Close</button>
				<button class="btn btn-soft btn-error" type="submit">
					{#if $delayed}
						<span class="loading loading-xs loading-spinner"></span>
					{:else}
						Archive
					{/if}
				</button>

				<button
					class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm"
					type="button"
					onclick={() => dialog.close()}><X class="size-4" /></button
				>
			</div>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop h-dvh">
		<button>x</button>
	</form>
</dialog>
