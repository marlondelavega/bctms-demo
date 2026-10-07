<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms/client';
	import { X } from '@lucide/svelte';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import { Toaster } from 'svelte-sonner';
	import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';

	let {
		superform
	}: {
		superform: SuperForm<EnforcementGroup.Create, App.Superforms.Message>;
	} = $props();

	let { form, errors, constraints, enhance, delayed } = $derived(superform);

	let input: HTMLInputElement | undefined = $state();
	let dialog: HTMLDialogElement;
</script>

<dialog id="group_add" class="modal p-2 backdrop-blur-xs" bind:this={dialog}>
	<Toaster position="top-center" richColors />

	<div class="relative modal-box flex w-full flex-col gap-4 md:w-5/12">
		<h3 class="font-bold">New Enforcement Group</h3>

		<form method="POST" action="?/create" use:enhance novalidate>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Enforcement group<span class="text-error">*</span></legend>
				<input
					name="name"
					type="text"
					class="input w-full"
					class:border-error={$errors.name}
					placeholder="Anti-smoking group"
					bind:this={input}
					bind:value={$form.name}
					{...$constraints.name}
					aria-invalid={$errors.name ? true : undefined}
				/>
				<InputError>{$errors.name && $errors?.name[0]}</InputError>
			</fieldset>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">Description<span class="text-error">*</span></legend>
				<textarea
					name="description"
					class="textarea w-full"
					class:border-error={$errors.description}
					placeholder="The group's description goes here..."
					bind:value={$form.description}
					{...$constraints.description}
					aria-invalid={$errors.description ? true : undefined}>{$form.description}</textarea
				>
				<InputError>{$errors.description && $errors?.description[0]}</InputError>
			</fieldset>

			<div class="modal-action mt-0">
				<button class="btn btn-ghost" type="button" onclick={() => dialog.close()}>Close</button>
				<button class="btn btn-primary" type="submit">
					{#if $delayed}
						<span class="loading loading-xs loading-spinner"></span>
					{:else}
						Submit
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
