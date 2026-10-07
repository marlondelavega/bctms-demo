<script lang="ts">
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import { X } from '@lucide/svelte';
	import { Toaster } from 'svelte-sonner';
	import { dateProxy, type SuperForm } from 'sveltekit-superforms';
	import type Ticket from '$lib/validation_schemas/Tickets.zod.js';

	//#region form
	let {
		superform
	}: {
		superform: SuperForm<Ticket.Create>;
	} = $props();

	let { form, errors, constraints, enhance, delayed } = superform;
	//#endregion

	let dialog: HTMLDialogElement;

	let date_created_proxy = dateProxy(superform, 'date_created', { format: 'date' });
</script>

<dialog
	id="ticket_add"
	class="modal grid-cols-1 grid-rows-1 p-4 backdrop-blur-xs md:p-2"
	bind:this={dialog}
>
	<Toaster position="top-center" richColors />

	<div class="relative modal-box flex max-h-full w-full flex-col gap-4 md:w-5/12">
		<h3 class="font-bold">Register New Ticket</h3>

		<form
			use:enhance
			action="?/create"
			method="POST"
			novalidate
			class="grid min-h-0 grow grid-cols-12 gap-x-2 overflow-y-auto"
			id="ticket_addmodal"
		>
			<fieldset class="col-span-12 fieldset">
				<legend class="fieldset-legend">Ticket name<span class="text-error">*</span></legend>
				<input
					name="name"
					type="text"
					class="input w-full"
					class:border-error={$errors.name}
					placeholder="AS_U_1001_1050"
					bind:value={$form.name}
					{...$constraints.name}
					aria-invalid={$errors.name ? true : undefined}
				/>
				<InputError>{$errors.name && $errors?.name[0]}</InputError>
			</fieldset>

			<fieldset class="col-span-12 fieldset">
				<legend class="fieldset-legend">Ticket number<span class="text-error">*</span></legend>
				<div class="flex flex-row items-center gap-2">
					<input
						name="ticket_num_from"
						type="number"
						class="input w-full"
						class:border-error={$errors.ticket_num_from}
						placeholder="AS_U_1001_1050"
						bind:value={$form.ticket_num_from}
						{...$constraints.ticket_num_from}
						aria-invalid={$errors.ticket_num_from ? true : undefined}
					/>

					<span>-</span>

					<input
						name="ticket_num_to"
						type="number"
						class="input w-full"
						class:border-error={$errors.ticket_num_to}
						placeholder="AS_U_1001_1050"
						bind:value={$form.ticket_num_to}
						{...$constraints.ticket_num_to}
						aria-invalid={$errors.ticket_num_to ? true : undefined}
					/>
				</div>
				<InputError>{$errors.ticket_num_to && $errors?.ticket_num_to[0]}</InputError>
				<InputError>{$errors.ticket_num_from && $errors?.ticket_num_from[0]}</InputError>
			</fieldset>

			<fieldset class="col-span-8 fieldset">
				<legend class="fieldset-legend">Date created<span class="text-error">*</span></legend>
				<input
					name="date_created"
					type="date"
					class="input w-full"
					class:border-error={$errors.date_created}
					bind:value={$date_created_proxy}
					{...$constraints.date_created}
					aria-invalid={$errors.date_created ? true : undefined}
				/>
				<InputError>{$errors.date_created && $errors?.date_created[0]}</InputError>
			</fieldset>
		</form>

		<div class="modal-action mt-0">
			<button class="btn btn-ghost" type="button" onclick={() => dialog.close()}>Close</button>
			<button class="btn btn-primary" type="submit" form="ticket_addmodal">
				{#if $delayed}
					<span class="loading loading-xs loading-spinner"></span>
				{:else}
					Register
				{/if}
			</button>

			<button
				class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm"
				type="button"
				onclick={() => dialog.close()}><X class="size-4" /></button
			>
		</div>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button>x</button>
	</form>
</dialog>
