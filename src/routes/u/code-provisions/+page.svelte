<script lang="ts">
	import CodeProvision_ArchiveModal from './CodeProvision_ArchiveModal.svelte';
	import CodeProvision_RestoreModal from './CodeProvision_RestoreModal.svelte';
	import Pagination from '$lib/ui/components/pagination/Pagination.svelte';
	import RowActions, { type RowAction } from '$lib/ui/components/table/RowActions.svelte';
	import Table from '$lib/ui/components/table/Table.svelte';
	import { permissions } from '$lib/utilities/helper';
	import { Archive, CirclePlus, Info, Plus, RotateCcw, SquarePen } from '@lucide/svelte';
	import { superForm, type SuperForm } from 'sveltekit-superforms';
	import type CodeProvision from '$lib/validation_schemas/CodeProvisions.zod.js';
	import { SvelteSet } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import Can from '$lib/ui/components/Can.svelte';
	import Permission from '$lib/validation_schemas/Permissions.zod.js';
	import Header from '$lib/ui/layout/header/Header.svelte';

	let { data } = $props();

	//#region forms

	// svelte-ignore state_referenced_locally
	const archiveForm: SuperForm<CodeProvision.Archive, App.Superforms.Message> = superForm(
		data.archive_form,
		{
			dataType: 'json',
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('code_provision_archive') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			}
		}
	);

	// svelte-ignore state_referenced_locally
	const restoreForm: SuperForm<CodeProvision.Restore, App.Superforms.Message> = superForm(
		data.restore_form,
		{
			dataType: 'json',
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('code_provision_restore') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			}
		}
	);

	//#endregion

	//#region row selection

	let selected_rows = $state(new Set<CodeProvision.Base>());
	let archiveable = $derived.by(() => [...selected_rows].some((item) => item.archived === false));

	const toggleRowSelect = (_d: CodeProvision.Base, checked: boolean) => {
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
			selected_rows = new SvelteSet(data.code_provisions.data);
		}
	};

	//#endregion

	let _p = permissions.get('code_provisions', data.user?.user_type.permissions);

	// no column at all for a role that can't do any of the row actions
	const show_actions = _p.edit !== 'none' || _p.restore !== 'none' || _p.archive !== 'none';

	// row quick actions reuse the dialogs below, which act on the selection: select just this row
	// (it shows as checked, so it's clear who the dialog is about), then open the dialog
	const openForRow = (_d: CodeProvision.Base, dialog_id: string) => {
		selected_rows = new SvelteSet([_d]);
		(document.getElementById(dialog_id) as HTMLDialogElement)?.showModal();
	};

	const rowActions = (item: CodeProvision.Base): RowAction[] => [
		_p.edit !== 'none'
			? {
					tip: 'Edit',
					label: `Edit ${item.code}`,
					icon: SquarePen,
					tone: 'info',
					href: resolve(`/u/code-provisions/${item._id}/edit`)
				}
			: null,
		item.archived
			? _p.restore !== 'none'
				? {
						tip: 'Restore',
						label: `Restore ${item.code}`,
						icon: RotateCcw,
						tone: 'success',
						onclick: () => openForRow(item, 'code_provision_restore')
					}
				: null
			: _p.archive !== 'none'
				? {
						tip: 'Archive',
						label: `Archive ${item.code}`,
						icon: Archive,
						tone: 'error',
						onclick: () => openForRow(item, 'code_provision_archive')
					}
				: null
	];
</script>

<Header title="Code Provisions">
	{#snippet AddButtons()}
		<Can
			permissions={data.user?.user_type.permissions}
			action={Permission.Actions.CREATE}
			route="code_provisions"
		>
			<a
				type="button"
				class="btn hidden h-10 w-20 border-0 capitalize shadow-none btn-sm btn-primary md:flex"
				href={resolve('/u/code-provisions/create')}
			>
				<CirclePlus class="size-4" />
				<span class="pr-0.5">Add</span>
			</a>

			<div class="fab bottom-24 block md:hidden">
				<a
					class="btn btn-circle size-12 p-0 btn-primary"
					href={resolve('/u/code-provisions/create')}
				>
					<Plus class="size-5" />
				</a>
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
				permissions={data.user?.user_type.permissions}
				action={Permission.Actions.EDIT}
				route="code_provisions"
			>
				<a
					class="btn capitalize btn-soft btn-xs btn-info"
					href={resolve(`/u/code-provisions/${[...selected_rows][0]._id}/edit`)}
				>
					<SquarePen class=" size-4" />edit
				</a>
			</Can>
		{/if}

		{#if !archiveable}
			<Can
				permissions={data.user?.user_type.permissions}
				action={Permission.Actions.RESTORE}
				route="code_provisions"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-success"
					type="button"
					onclick={() =>
						(document.getElementById('code_provision_restore') as HTMLDialogElement)?.showModal()}
				>
					<RotateCcw class=" size-4" />{selected_rows.size > 1 ? 'bulk' : ''} restore
				</button>
			</Can>
		{:else}
			<Can
				permissions={data.user?.user_type.permissions}
				action={Permission.Actions.ARCHIVE}
				route="code_provisions"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-error"
					type="button"
					onclick={() =>
						(document.getElementById('code_provision_archive') as HTMLDialogElement)?.showModal()}
				>
					<Archive class=" size-4" />{selected_rows.size > 1 ? 'bulk' : ''} archive
				</button>
			</Can>
		{/if}
	</div>
</div>

{#key data}
	<Table>
		{#snippet table_header()}
			<th class="w-4"
				><input
					type="checkbox"
					class="checkbox checkbox-xs"
					onchange={(e) => toggleRowSelectAll(!e.currentTarget.checked)}
					aria-label="Select all code provisions on this page"
					indeterminate={selected_rows.size > 0 &&
						selected_rows.size < data.code_provisions.data.length}
					checked={data.code_provisions.data.length > 0 &&
						selected_rows.size == data.code_provisions.data.length}
				/></th
			>
			<th>Code</th>
			<th>Descriptor</th>
			<th>Description</th>
			<th>Category</th>
			<th colspan="3" class="text-center"
				>Penalty <div
					class="tooltip tooltip-left p-0 text-xs"
					data-tip="Succeeding penalties are available to view in the details page."
				>
					<Info class="size-3 cursor-pointer" />
				</div>
			</th>
			<th>Status</th>
			{#if show_actions}
				<th class="w-0"><span class="sr-only">Actions</span></th>
			{/if}
		{/snippet}

		{#snippet table_subHeader()}
			<tr class="text-xs">
				<th></th>
				<th></th>
				<th></th>
				<th></th>
				<th></th>
				<th class=" text-yellow-500">1st offense</th>
				<th class=" text-orange-500">2nd offense</th>
				<th class=" text-red-600">3rd offense</th>
				<th></th>
				{#if show_actions}
					<th></th>
				{/if}
			</tr>
		{/snippet}

		{#snippet table_body()}
			{#each data.code_provisions.data as item, index (index)}
				<tr class={['has-[input:checked]:bg-primary/10', item.archived && 'text-base-content/50']}>
					<td>
						<input
							type="checkbox"
							class="checkbox checkbox-xs"
							aria-label={`Select ${item.code}`}
							onchange={(e) => toggleRowSelect(item, e.currentTarget.checked)}
							checked={[...selected_rows].some((r) => r._id === item._id)}
						/>
					</td>
					<td class="truncate">{item.code}</td>
					<td><span class="line-clamp-2">{item.descriptor}</span></td>
					<td><span class="line-clamp-2">{item.description}</span></td>
					<td class="truncate">
						{item.violation_category.sub_categories.find(
							(i: { _id: string; name: string }) => i._id === item.violation_sub_category
						).name}
					</td>
					{@render offenseSnippet(item.penalty[0] || {})}
					{@render offenseSnippet(item.penalty[1] || {})}
					{@render offenseSnippet(item.penalty[2] || {})}
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
						colspan={show_actions ? 10 : 9}
						class={[
							'py-10 text-center',
							data.authorized ? 'text-base-content/60' : 'text-error/80'
						]}
					>
						{!data.authorized ? `${data.message}` : `No code provisions match these filters.`}
					</td>
				</tr>
			{/each}
		{/snippet}
	</Table>
{/key}

<Pagination total={data.total_count} />

{#snippet offenseSnippet({
	pecuniary,
	disciplinary
}: {
	pecuniary?: number | undefined;
	disciplinary?: string | undefined;
})}
	{#if !pecuniary && !disciplinary}
		<td>-</td>
	{:else if pecuniary && disciplinary}
		<td><span class="line-clamp-1">PHP {pecuniary} + {disciplinary}</span></td>
	{:else if pecuniary}
		<td><span class="line-clamp-1">PHP {pecuniary}</span></td>
	{:else if disciplinary}
		<td><span class="line-clamp-1">{disciplinary}</span></td>
	{/if}
{/snippet}

<CodeProvision_ArchiveModal superform={archiveForm} archive_data={[...selected_rows]} />
<CodeProvision_RestoreModal superform={restoreForm} restore_data={[...selected_rows]} />
