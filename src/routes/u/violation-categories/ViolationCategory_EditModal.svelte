<script lang="ts">
	import { resolve } from '$app/paths';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import type ViolationCategory from '$lib/validation_schemas/ViolationCategories.zod';
	import { X } from '@lucide/svelte';
	import { toast, Toaster } from 'svelte-sonner';
	import type { SuperForm } from 'sveltekit-superforms';

	let dialog: HTMLDialogElement;

	//#region form

	let {
		super_form,
		edit_data
	}: { super_form: SuperForm<ViolationCategory.Edit>; edit_data: ViolationCategory.Base } =
		$props();

	let { form, errors, constraints, enhance, delayed } = super_form;

	//#endregion

	$effect(() => {
		async function _f(data: ViolationCategory.Base) {
			if (data._id && data._id.trim() !== '') {
				let _r = await fetch(resolve(`/api/violation-categories/${data._id}`));
				let _d = await _r.json();

				form.set({
					_id: _d.data._id,
					name: _d.data.name,
					description: _d.data.description,
					sub_categories: _d.data.sub_categories
				});
			}
		}

		if (edit_data) {
			_f(edit_data);
		}
	});
</script>

<dialog id="category_edit" class="modal p-2 backdrop-blur-xs" bind:this={dialog}>
	<Toaster position="top-center" richColors></Toaster>

	<div class="relative modal-box flex w-full flex-col gap-4 md:w-5/12">
		<h3 class="font-bold">Edit Violation Category</h3>

		<form method="POST" action="?/edit" use:enhance novalidate>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Violation Category<span class="text-error">*</span></legend>
				<input
					name="name"
					type="text"
					class="input w-full"
					class:border-error={$errors.name}
					placeholder="Public Health & Safety"
					bind:value={$form.name}
					{...$constraints.name}
					aria-invalid={$errors.name ? true : undefined}
				/>
				<InputError>{$errors.name && $errors?.name[0]}</InputError>
			</fieldset>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">Description<span class="text-error">*</span></legend>
				<input
					name="description"
					type="text"
					class="input w-full"
					class:border-error={$errors.description}
					placeholder="Violations that involves risks to the general well-being of the public."
					bind:value={$form.description}
					{...$constraints.description}
					aria-invalid={$errors.description ? true : undefined}
				/>
				<InputError>{$errors.description && $errors?.description[0]}</InputError>
			</fieldset>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">Sub-categories<span class="text-error">*</span></legend>

				<div class=" flex flex-row flex-wrap items-center gap-2">
					{#each $form.sub_categories as _sub_cat, index (index)}
						<div class="relative h-fit w-fit">
							<input
								name={`sub_categories[${index}].name`}
								type="text"
								class="input w-32"
								class:border-error={$errors.sub_categories}
								placeholder="Smoking"
								bind:value={$form.sub_categories[index].name}
								aria-invalid={$errors.sub_categories ? true : undefined}
								{...$constraints.sub_categories?.name}
							/>

							<button
								class={`absolute -top-1 -right-2 z-40 cursor-pointer bg-base-100 p-1 transition-all hover:rounded-full ${$form.sub_categories.length <= 1 ? 'hover:bg-base-100' : 'hover:bg-base-300'}`}
								type="button"
								onclick={() => {
									if ($form.sub_categories.length > 1) {
										$form.sub_categories = $form.sub_categories.toSpliced(index, 1);
									} else {
										toast.warning('Cannot remove item. At least one sub-category is required.');
									}
								}}
							>
								<X
									class={`size-3 ${$form.sub_categories.length <= 1 ? 'stroke-base-content/50' : 'stroke-error'}`}
								/>
							</button>
						</div>
					{/each}

					<button
						class="btn btn-soft btn-sm btn-primary"
						onclick={() => ($form.sub_categories = [...$form.sub_categories, { name: '' }])}
						type="button"
					>
						Add +
					</button>
				</div>

				<InputError>{$errors.sub_categories && $errors?.sub_categories[0]}</InputError>
			</fieldset>

			<div class="modal-action mt-0">
				<button class="btn btn-ghost" type="button" onclick={() => dialog.close()}>Cancel</button>
				<button class="btn btn-primary" type="submit">
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
		</form>
	</div>

	<form method="dialog" class="modal-backdrop h-dvh">
		<button>x</button>
	</form>
</dialog>
