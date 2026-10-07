<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms/client';
	import { ArchiveX, X } from '@lucide/svelte';
	import { Toaster } from 'svelte-sonner';
	import type UserType from '$lib/validation_schemas/UserTypes.zod';

	let {
		superform,
		archive_data
	}: {
		superform: SuperForm<UserType.Archive, App.Superforms.Message>;
		archive_data: UserType.Base[];
	} = $props();

	let { form, enhance, delayed } = superform;

	$effect(() => {
		$form._ids = archive_data.map((i) => i._id);
	});

	let dialog: HTMLDialogElement;
</script>

<dialog id="user_type_archive" class="modal" bind:this={dialog}>
	<Toaster position="top-center" richColors />

	<div class="relative modal-box flex w-5/12 min-w-96 flex-col gap-4">
		<div class="flex flex-row items-center gap-4">
			<ArchiveX class=" size-6 stroke-error" />

			<h3 class="font-bold text-error">
				Archive User Type{archive_data.length > 1 ? 's' : ''}?
			</h3>
		</div>

		<form method="POST" action="?/archive" use:enhance novalidate>
			<div class="mb-4 flex flex-col gap-2 text-xs">
				{#if archive_data.length > 1}
					<p>
						Archiving these User Types will remove them from standard views but they will remain
						fully accessible.
					</p>

					<p>You can filter for archived items and restore them at any time.</p>
				{:else}
					<p>
						Archiving this User Type will remove it from standard views but they will remain fully
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
