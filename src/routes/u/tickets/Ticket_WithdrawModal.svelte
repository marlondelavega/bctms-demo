<script lang="ts">
	import { resolve } from '$app/paths';
	import type { SelectItems } from '$lib/types/T_select_options';
	import Combo from '$lib/ui/components/input/Combo.svelte';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import { parseSelectItems } from '$lib/utilities/helper';
	import type Ticket from '$lib/validation_schemas/Tickets.zod';

	import { X } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';
	import type { Writable } from 'svelte/store';
	import { dateProxy, type SuperForm } from 'sveltekit-superforms';

	let dialog: HTMLDialogElement;

	let {
		superform,
		edit_data
	}: { superform: SuperForm<Ticket.Withdraw>; edit_data: Ticket.Base[] } = $props();
	let { form, errors, constraints, enhance, delayed } = superform;

	//#region combobox

	let enforcement_group_select = $state<SelectItems[]>([]);
	let users_select = $state<SelectItems[]>([]);

	//search functions
	const searchEnforcementGroup = async (e: string) => {
		let _rq = await fetch(resolve(`/api/enforcement-groups?page=1&size=5&search=${e}`));
		let _rs = await _rq.json();
		enforcement_group_select = parseSelectItems(_rs.data, 'name', '_id');
	};

	const searchUsers = async (_id: string) => {
		if (!_id || _id.trim() == '') {
			users_select = [];
			return;
		}

		await fetch(resolve(`/api/users?page=1&size=5&enforcement_group=${_id}&user_type=office admin`))
			.then((res) => {
				if (!res.ok) {
					return;
				}
				return res.json();
			})
			.then((d) => {
				if (!d) {
					users_select = [];
					return;
				}

				users_select = parseSelectItems(d.data, ['firstname', 'middlename', 'lastname'], '_id');
			});
	};

	//#endregion

	onMount(async () => {
		searchEnforcementGroup('');
	});

	$effect(() => {
		if (edit_data && edit_data.length) {
			let _ids = edit_data.map((d) => d._id);
			$form._ids = _ids;
		}
	});

	let date_withdrawn_proxy: Writable<string> = dateProxy(superform, 'date_withdrawn', {
		format: 'date'
	});
</script>

<dialog id="ticket_withdraw" class="modal p-2 backdrop-blur-xs" bind:this={dialog}>
	<Toaster position="top-center" richColors />

	<div class="relative modal-box flex max-h-full w-full flex-col gap-4 md:w-5/12">
		<h3 class="font-bold">Withdraw Ticket</h3>

		<div class=" flex min-w-48 flex-col gap-2 py-2">
			<p class="text-xs font-semibold">Tickets to withdraw</p>
			<div class="min-h-0 grow overflow-y-auto">
				{#if edit_data}
					<div class="flex list-decimal flex-row flex-wrap gap-x-6 gap-y-4 text-xs">
						{#each edit_data.slice(0, 5) as e, index (index)}
							<span>{index + 1}. {e.name}</span>
						{/each}
						{#if edit_data.length - 5 >= 0}
							<span>+{edit_data.length - 5} more...</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<form
			novalidate
			use:enhance
			action="?/withdraw"
			method="POST"
			id="ticket_withdrawmodal"
			class="grid min-h-0 grow grid-cols-2 items-end gap-x-2 overflow-y-auto"
		>
			<input
				name="withdraw"
				type="checkbox"
				class="checkbox hidden checkbox-xs"
				class:border-error={$errors.withdraw}
				placeholder=""
				bind:checked={$form.withdraw}
				{...$constraints.withdraw}
				aria-invalid={$errors.withdraw ? true : undefined}
				disabled
				readonly
			/>

			<input
				name="_ids"
				type="hidden"
				class="hidden"
				class:border-error={$errors._ids}
				placeholder=""
				bind:value={$form._ids}
				{...$constraints._ids}
				aria-invalid={$errors._ids ? true : undefined}
			/>

			<div class="col-span-1">
				<Combo
					options={enforcement_group_select}
					placeholder="Select from the list..."
					empty_error="No group found..."
					label="Ticket for"
					on_search={(e: string) => searchEnforcementGroup(e)}
					name="ticket_for"
					bind:value={$form.ticket_for}
					errors={$errors.ticket_for}
					constraints={$constraints.ticket_for}
					on_select={(e: SelectItems) => {
						$form.ticket_for = e.value as string;
						searchUsers(e.value as string);
					}}
					width="full"
				/>
			</div>

			<fieldset class="col-span-1 fieldset">
				<legend class="fieldset-legend flex w-full flex-row items-end justify-between gap-2">
					<div class="flex flex-row gap-2">Date withdrawn<span class="text-error">*</span></div>
					<button
						class="btn btn-soft btn-xs btn-primary"
						type="button"
						onclick={() => {
							$form.date_withdrawn = new Date();
						}}>today</button
					>
				</legend>
				<input
					name="date_withdrawn"
					type="date"
					class="input w-full"
					class:border-error={$errors.date_withdrawn}
					bind:value={$date_withdrawn_proxy}
					{...$constraints.date_withdrawn}
					aria-invalid={$errors.date_withdrawn ? true : undefined}
				/>
				<InputError>{$errors.date_withdrawn && $errors?.date_withdrawn[0]}</InputError>
			</fieldset>

			<div class="col-span-full">
				<Combo
					options={users_select}
					placeholder="Select in-charge from the list..."
					empty_error={$form.ticket_for
						? 'No users found...'
						: 'Select enforcement group to display users to assign.'}
					label="Person in-charge"
					on_search={() => {}}
					name="in_charge"
					bind:value={$form.in_charge}
					errors={$errors.in_charge}
					constraints={$constraints.in_charge}
					on_select={(e: SelectItems) => ($form.in_charge = e.value as string)}
					width="full"
				/>
			</div>
		</form>

		<div class="modal-action mt-0">
			<button class="btn btn-ghost" type="button" onclick={() => dialog.close()}>Cancel</button>
			<button class="btn btn-primary" type="submit" form="ticket_withdrawmodal">
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

	<form method="dialog" class="modal-backdrop h-dvh">
		<button>x</button>
	</form>
</dialog>
