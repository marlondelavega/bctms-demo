<script lang="ts">
	import type Ticket from '$lib/validation_schemas/Tickets.zod';
	import { RotateCcw, X } from '@lucide/svelte';
	import { Toaster } from 'svelte-sonner';
	import type { SuperForm } from 'sveltekit-superforms';

	let {
		superform,
		restore_data
	}: { superform: SuperForm<Ticket.Restore>; restore_data: Ticket.Base[] } = $props();

	let { form, enhance, delayed } = superform;

	let dialog: HTMLDialogElement;

	$effect(() => {
		if (restore_data) {
			let _ids = restore_data.map((d) => d._id);

			$form._ids = _ids;
		}
	});
</script>

<dialog id="ticket_restore" class="modal p-2 backdrop-blur-xs" bind:this={dialog}>
	<Toaster position="top-center" richColors />

	<div class="relative modal-box flex w-full flex-col gap-4 md:w-5/12">
		<div class="flex flex-row items-center gap-4">
			<RotateCcw class=" size-6 stroke-success" />

			<h3 class="font-bold text-success">
				Restore Ticket{restore_data.length > 1 ? 's' : ''}?
			</h3>
		</div>

		<form method="POST" action="?/restore" use:enhance novalidate>
			<input type="hidden" name="_ids" value={$form._ids} />

			<div class="mb-4 flex flex-col gap-2 text-xs">
				{#if restore_data.length > 1}
					<p>
						Restoring these Tickets will immediately return them to standard views and make them
						fully available for use.
					</p>

					<p>
						You can archive the item/s again and continue to access them in archived lists at any
						time.
					</p>
				{:else}
					<p>
						Restoring this Ticket will immediately return it to standard views and make it fully
						available for use.
					</p>

					<p>
						You can archive the item again and continue to access it in archived lists at any time.
					</p>
				{/if}
			</div>

			<div class="modal-action mt-0">
				<button class="btn btn-ghost" type="button" onclick={() => dialog.close()}>Close</button>
				<button class="btn btn-soft btn-success" type="submit">
					{#if $delayed}
						<span class="loading loading-xs loading-spinner"></span>
					{:else}
						Restore
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
