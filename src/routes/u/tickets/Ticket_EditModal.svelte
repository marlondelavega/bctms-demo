<script lang="ts">
	import { resolve } from '$app/paths';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import type Ticket from '$lib/validation_schemas/Tickets.zod';
	import { X } from '@lucide/svelte';
	import { Toaster } from 'svelte-sonner';
	import { dateProxy, type SuperForm } from 'sveltekit-superforms';

	let dialog: HTMLDialogElement;

	let { superform, edit_data }: { superform: SuperForm<Ticket.Edit>; edit_data: Ticket.Base } =
		$props();
	let { form, errors, constraints, enhance, delayed } = superform;

	//#region combobox

	const getEditData = async (_data: Ticket.Base) => {
		if (_data._id && _data._id.trim() !== '') {
			let _r = await fetch(resolve(`/api/tickets/${_data._id}`));
			let { data }: { data: Ticket.Base } = await _r.json();
			form.set({
				_id: data._id,
				name: data.name,
				date_created: data.date_created,
				ticket_num_from: data.ticket_num_from,
				ticket_num_to: data.ticket_num_to,
				withdraw: false,
				date_withdrawn: data.date_withdrawn
			});
		}
	};

	//#endregion

	$effect(() => {
		if (edit_data) {
			getEditData(edit_data);
			$form._id = edit_data._id;
		}
	});

	let date_created_proxy = dateProxy(superform, 'date_created', { format: 'date' });
</script>

<dialog
	id="ticket_edit"
	class="modal grid-cols-1 grid-rows-1 p-4 backdrop-blur-xs md:p-2"
	bind:this={dialog}
>
	<Toaster position="top-center" richColors />

	<div class="relative modal-box flex max-h-full w-full flex-col gap-4 md:w-5/12">
		<h3 class="font-bold">Edit Ticket</h3>

		<form
			novalidate
			use:enhance
			action="?/edit"
			method="POST"
			class="grid min-h-0 grow grid-cols-12 gap-x-2 overflow-y-auto"
			id="ticket_editmodal"
		>
			<input
				name="_id"
				type="hidden"
				class="hidden"
				class:border-error={$errors._id}
				placeholder=""
				bind:value={$form._id}
				{...$constraints._id}
				aria-invalid={$errors._id ? true : undefined}
			/>
			<fieldset class="col-span-full fieldset">
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

			<fieldset class="col-span-full fieldset">
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
			<button class="btn btn-ghost" type="button" onclick={() => dialog.close()}>Cancel</button>
			<button class="btn btn-primary" type="submit" form="ticket_editmodal">
				{#if $delayed}
					<span class="loading loading-xs loading-spinner"></span>
				{:else}
					Save
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
