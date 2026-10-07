<script lang="ts">
	import ViolationCategory_RestoreModal from './ViolationCategory_RestoreModal.svelte';
	import ViolationCategory_ArchiveModal from './ViolationCategory_ArchiveModal.svelte';
	import ViolationCategory_EditModal from './ViolationCategory_EditModal.svelte';
	import { superForm, type SuperForm } from 'sveltekit-superforms';
	import ViolationCategory_AddModal from './ViolationCategory_AddModal.svelte';
	import { toast } from 'svelte-sonner';
	import Pagination from '$lib/ui/components/pagination/Pagination.svelte';
	import RowActions, { type RowAction } from '$lib/ui/components/table/RowActions.svelte';
	import Table from '$lib/ui/components/table/Table.svelte';
	import { permissions } from '$lib/utilities/helper';
	import { Archive, RotateCcw, SquarePen } from '@lucide/svelte';
	import type ViolationCategory from '$lib/validation_schemas/ViolationCategories.zod.js';
	import { SvelteSet } from 'svelte/reactivity';
	import Can from '$lib/ui/components/Can.svelte';
	import Permission from '$lib/validation_schemas/Permissions.zod.js';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { CirclePlus, Plus } from '@lucide/svelte';

	let { data } = $props();

	//#region form

	const create_form: SuperForm<ViolationCategory.Create, App.Superforms.Message> = superForm(
		data.createForm,
		{
			delayMs: 500,
			timeoutMs: 8000,
			dataType: 'json'
		}
	);

	const edit_form: SuperForm<ViolationCategory.Edit, App.Superforms.Message> = superForm(
		data.editForm,
		{
			delayMs: 500,
			timeoutMs: 8000,
			dataType: 'json',
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('category_edit') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			}
		}
	);

	const archive_form: SuperForm<ViolationCategory.Archive, App.Superforms.Message> = superForm(
		data.archiveForm,
		{
			dataType: 'json',
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('category_archive') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			}
		}
	);

	const restore_form: SuperForm<ViolationCategory.Restore, App.Superforms.Message> = superForm(
		data.restoreForm,
		{
			dataType: 'json',
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('category_restore') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			}
		}
	);

	//#endregion

	//#region selected rows

	let selected_rows = $state(new Set<ViolationCategory.Base>());
	let archiveable = $derived.by(() => [...selected_rows].some((item) => item.archived === false));

	const toggleRowSelect = (_d: ViolationCategory.Base, checked: boolean) => {
		if (checked) {
			selected_rows.add(_d);
		} else {
			selected_rows.delete(_d);
		}
		selected_rows = new SvelteSet(selected_rows);
	};

	const toggleRowSelectAll = (checked: boolean) => {
		if (checked) {
			selected_rows = new SvelteSet();
		} else {
			selected_rows = new SvelteSet(data.violation_categories.data);
		}
	};

	//#endregion

	[create_form.message, edit_form.message, archive_form.message].forEach((_msg) => {
		_msg.subscribe((_m) => {
			if (_m?.type == 'success') {
				toast.success(_m.text);
			} else if (_m?.type == 'error') {
				toast.error(_m.text);
			}
		});
	});

	let _p = permissions.get('violation_categories', data.user?.user_type.permissions);

	// no column at all for a role that can't do any of the row actions
	const show_actions = _p.edit !== 'none' || _p.restore !== 'none' || _p.archive !== 'none';

	// row quick actions reuse the dialogs below, which act on the selection: select just this row
	// (it shows as checked, so it's clear who the dialog is about), then open the dialog
	const openForRow = (_d: ViolationCategory.Base, dialog_id: string) => {
		selected_rows = new SvelteSet([_d]);
		(document.getElementById(dialog_id) as HTMLDialogElement)?.showModal();
	};

	const rowActions = (item: ViolationCategory.Base): RowAction[] => [
		_p.edit !== 'none'
			? {
					tip: 'Edit',
					label: `Edit ${item.name}`,
					icon: SquarePen,
					tone: 'info',
					onclick: () => openForRow(item, 'category_edit')
				}
			: null,
		item.archived
			? _p.restore !== 'none'
				? {
						tip: 'Restore',
						label: `Restore ${item.name}`,
						icon: RotateCcw,
						tone: 'success',
						onclick: () => openForRow(item, 'category_restore')
					}
				: null
			: _p.archive !== 'none'
				? {
						tip: 'Archive',
						label: `Archive ${item.name}`,
						icon: Archive,
						tone: 'error',
						onclick: () => openForRow(item, 'category_archive')
					}
				: null
	];
</script>

<Header title="Violation Categories">
	{#snippet AddButtons()}
		<Can
			permissions={data.user.user_type.permissions}
			action={Permission.Actions.CREATE}
			route="violation_categories"
		>
			<button
				type="button"
				class="btn hidden h-10 w-20 border-0 capitalize shadow-none btn-sm btn-primary md:flex"
				onclick={() => (document.getElementById('category_add') as HTMLDialogElement)?.showModal()}
			>
				<CirclePlus class="size-4" />
				<span class="pr-0.5">Add</span>
			</button>

			<div class="fab bottom-24 block md:hidden">
				<button
					class="btn btn-circle size-12 p-0 btn-primary"
					type="button"
					onclick={() =>
						(document.getElementById('category_add') as HTMLDialogElement)?.showModal()}
				>
					<Plus class="size-5" />
				</button>
			</div>
		</Can>
	{/snippet}
</Header>

<div class="flex w-full flex-row justify-between gap-4 px-6 py-2">
	<div class="invisible flex flex-row items-center gap-2" class:visible={selected_rows.size}>
		<p class="text-sm">
			{selected_rows.size}
			{selected_rows.size > 1 ? 'rows' : 'row'} selected
		</p>

		{#if selected_rows.size == 1}
			<Can
				permissions={data.user.user_type.permissions}
				action={Permission.Actions.EDIT}
				route="violation_categories"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-info"
					type="button"
					onclick={() =>
						(document.getElementById('category_edit') as HTMLDialogElement)?.showModal()}
				>
					<SquarePen class=" size-4" />edit
				</button>
			</Can>
		{/if}

		{#if !archiveable}
			<Can
				permissions={data.user.user_type.permissions}
				action={Permission.Actions.RESTORE}
				route="violation_categories"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-success"
					type="button"
					onclick={() =>
						(document.getElementById('category_restore') as HTMLDialogElement)?.showModal()}
				>
					<RotateCcw class=" size-4" />{selected_rows.size > 1 ? 'bulk' : ''} restore
				</button>
			</Can>
		{:else}
			<Can
				permissions={data.user.user_type.permissions}
				action={Permission.Actions.ARCHIVE}
				route="violation_categories"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-error"
					type="button"
					onclick={() =>
						(document.getElementById('category_archive') as HTMLDialogElement)?.showModal()}
				>
					<Archive class=" size-4" />{selected_rows.size > 1 ? 'bulk' : ''} archive
				</button>
			</Can>
		{/if}
	</div>
</div>

{#key data.violation_categories}
	<Table>
		{#snippet table_header()}
			<th class="w-4"
				><input
					type="checkbox"
					class="checkbox checkbox-xs"
					onchange={(e) => toggleRowSelectAll(!e.currentTarget.checked)}
					aria-label="Select all categories on this page"
					indeterminate={selected_rows.size > 0 &&
						selected_rows.size < data.violation_categories.data.length}
					checked={data.violation_categories.data.length > 0 &&
						selected_rows.size == data.violation_categories.data.length}
				/></th
			>
			<th>Category Name</th>
			<th>Description</th>
			<th>Sub-categories</th>
			<th>Status</th>
			{#if show_actions}
				<th class="w-0"><span class="sr-only">Actions</span></th>
			{/if}
		{/snippet}

		{#snippet table_body()}
			{#each data.violation_categories.data as item, index (index)}
				<tr class={['has-[input:checked]:bg-primary/10', item.archived && 'text-base-content/50']}>
					<td>
						<input
							type="checkbox"
							class="checkbox checkbox-xs"
							aria-label={`Select ${item.name}`}
							onchange={(e) => toggleRowSelect(item, e.currentTarget.checked)}
							checked={[...selected_rows].some((r) => r._id === item._id)}
						/>
					</td>
					<td><span class="line-clamp-2">{item.name}</span></td>
					<td><span class="line-clamp-2">{item.description}</span></td>

					<td>
						<div class="flex flex-row flex-wrap gap-1.5">
							{#each item.sub_categories as _sc, index (index)}
								<span class="badge badge-soft badge-sm badge-primary">{_sc.name}</span>
							{/each}
						</div>
					</td>
					<td>
						{#if item.archived}
							<span class="badge badge-ghost badge-sm">Archived</span>
						{:else}
							<span class="badge badge-soft badge-sm badge-success">Active</span>
						{/if}
					</td>
					{#if show_actions}
						<td><RowActions actions={rowActions(item)} /></td>
					{/if}
				</tr>
			{:else}
				<tr>
					<td
						colspan={show_actions ? 6 : 5}
						class={[
							'py-10 text-center',
							data.authorized ? 'text-base-content/60' : 'text-error/80'
						]}
					>
						{!data.authorized ? `${data.message}` : `No categories match these filters.`}
					</td>
				</tr>
			{/each}
		{/snippet}
	</Table>
{/key}

<Pagination total={data.total_count} />

<ViolationCategory_AddModal super_form={create_form} />
<ViolationCategory_EditModal
	super_form={edit_form}
	edit_data={[...selected_rows][0] as ViolationCategory.Base}
/>
<ViolationCategory_ArchiveModal super_form={archive_form} archive_data={[...selected_rows]} />
<ViolationCategory_RestoreModal super_form={restore_form} restore_data={[...selected_rows]} />
