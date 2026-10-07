<script lang="ts">
	import { superForm, type SuperForm } from 'sveltekit-superforms';
	import Pagination from '$lib/ui/components/pagination/Pagination.svelte';
	import Filter from '$lib/ui/components/table/Filter.svelte';
	import RowActions, { type RowAction } from '$lib/ui/components/table/RowActions.svelte';
	import Table from '$lib/ui/components/table/Table.svelte';
	import { date, getPreviewUrl, parseAddress, parseName, permissions } from '$lib/utilities/helper';
	import { Archive, CirclePlus, RotateCcw, SquarePen } from '@lucide/svelte';
	import ViolatorArchiveModal from './ViolatorArchiveModal.svelte';
	import ViolatorRestoreModal from './ViolatorRestoreModal.svelte';
	import { toast } from 'svelte-sonner';
	import type Violator from '$lib/validation_schemas/Violators.zod.js';
	import Can from '$lib/ui/components/Can.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import Permission from '$lib/validation_schemas/Permissions.zod.js';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import { Plus } from '@lucide/svelte';

	let { data } = $props();

	let _p = permissions.get('violators', data.user?.user_type.permissions);

	//#region forms

	const archiveForm: SuperForm<Violator.Archive, App.Superforms.Message> = superForm(
		data.archive_form,
		{
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('violators_archive') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			},
			dataType: 'json'
		}
	);

	const restoreForm: SuperForm<Violator.Restore, App.Superforms.Message> = superForm(
		data.restore_form,
		{
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('violators_restore') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			},
			dataType: 'json'
		}
	);

	//#endregion

	//#region row selection block

	let selected_rows = $state(new Set<Violator.Base>());
	let archivable = $derived.by(() => {
		return [...selected_rows].some((item) => item.archived === false);
	});

	const toggleRowSelect = (_d: Violator.Base, checked: boolean) => {
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
			selected_rows = new SvelteSet(data.violators.data);
		}
	};

	// no column at all for a role that can't do any of the row actions
	const show_actions = _p.edit !== 'none' || _p.restore !== 'none' || _p.archive !== 'none';

	// row quick actions reuse the modals below, which act on the selection: select just this row
	// (it shows as checked, so it's clear who the dialog is about), then open the dialog
	const openForRow = (_d: Violator.Base, dialog_id: string) => {
		selected_rows = new SvelteSet([_d]);
		(document.getElementById(dialog_id) as HTMLDialogElement).showModal();
	};

	const rowActions = (item: Violator.Base): RowAction[] => [
		_p.edit !== 'none'
			? {
					tip: 'Edit',
					label: `Edit ${item.firstname} ${item.lastname}`,
					icon: SquarePen,
					tone: 'info',
					href: resolve(`/u/violators/${item._id}/edit`)
				}
			: null,
		item.archived
			? _p.restore !== 'none'
				? {
						tip: 'Restore',
						label: `Restore ${item.firstname} ${item.lastname}`,
						icon: RotateCcw,
						tone: 'success',
						onclick: () => openForRow(item, 'violators_restore')
					}
				: null
			: _p.archive !== 'none'
				? {
						tip: 'Archive',
						label: `Archive ${item.firstname} ${item.lastname}`,
						icon: Archive,
						tone: 'error',
						onclick: () => openForRow(item, 'violators_archive')
					}
				: null
	];

	//#endregion
</script>

<Header title="List of Violators">
	{#snippet PropFilter()}
		<Filter filters={['barangay']} />
	{/snippet}
	{#snippet AddButtons()}
		<Can
			permissions={data.user?.user_type.permissions}
			action={Permission.Actions.CREATE}
			route="violators"
		>
			<a
				type="button"
				class="btn hidden h-10 w-20 border-0 capitalize shadow-none btn-sm btn-primary md:flex"
				href={resolve('/u/violators/create')}
			>
				<CirclePlus class="size-4" />
				<span class="pr-0.5">Add</span>
			</a>

			<div class="fab bottom-24 block md:hidden">
				<a class="btn btn-circle size-12 p-0 btn-primary" href={resolve('/u/violators/create')}>
					<Plus class="size-5" />
				</a>
			</div>
		</Can>
	{/snippet}
</Header>

<div class="flex w-full flex-row justify-between gap-4 px-6 py-2">
	<div class="invisible flex flex-row items-center gap-2" class:visible={selected_rows.size}>
		<p class="text-xs md:text-sm">
			{selected_rows.size}
			{selected_rows.size > 1 ? 'rows' : 'row'} selected
		</p>

		{#if selected_rows.size == 1}
			<Can
				permissions={data.user?.user_type.permissions}
				action={Permission.Actions.EDIT}
				route="violators"
			>
				<a
					href={resolve(`/u/violators/${[...selected_rows][0]._id}/edit`)}
					class="btn capitalize btn-soft btn-xs btn-info"><SquarePen class=" size-4" />edit</a
				>
			</Can>
		{/if}

		{#if !archivable}
			<Can
				permissions={data.user?.user_type.permissions}
				action={Permission.Actions.RESTORE}
				route="violators"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-success"
					onclick={() => {
						(document.getElementById('violators_restore') as HTMLDialogElement).showModal();
					}}
					type="button"
				>
					<RotateCcw class=" size-4" />{selected_rows.size > 1 ? 'bulk' : ''} restore
				</button>
			</Can>
		{:else}
			<Can
				permissions={data.user?.user_type.permissions}
				action={Permission.Actions.ARCHIVE}
				route="violators"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-error"
					onclick={() => {
						(document.getElementById('violators_archive') as HTMLDialogElement).showModal();
					}}
					type="button"
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
			<th class="w-4">
				<input
					type="checkbox"
					class="checkbox checkbox-xs"
					onchange={(e) => toggleRowSelectAll(!e.currentTarget.checked)}
					aria-label="Select all violators on this page"
					indeterminate={selected_rows.size > 0 && selected_rows.size < data.violators.data.length}
					checked={data.violators.data.length > 0 &&
						selected_rows.size == data.violators.data.length}
				/>
			</th>
			<th>Name</th>
			<th class="hidden md:table-cell">Sex</th>
			<th class="hidden md:table-cell">Birthdate</th>
			<th class="">Address</th>
			<th class="hidden md:table-cell">License no.</th>
			<th class="hidden md:table-cell">Contact no.</th>
			<th>Status</th>
			{#if show_actions}
				<th class="w-0"><span class="sr-only">Actions</span></th>
			{/if}
		{/snippet}

		{#snippet table_body()}
			{#each data.violators.data as item, index (index)}
				<tr
					class={[
						'capitalize has-[input:checked]:bg-primary/10',
						item.archived && 'text-base-content/50'
					]}
				>
					<td>
						<input
							type="checkbox"
							class="checkbox checkbox-xs"
							aria-label={`Select ${item.firstname} ${item.lastname}`}
							onclick={(e) => e.stopPropagation()}
							onchange={(e) => {
								e.stopPropagation();
								toggleRowSelect(item, e.currentTarget.checked);
							}}
							checked={[...selected_rows].some((d) => d._id === item._id)}
						/>
					</td>

					<td>
						<div class="flex flex-row items-center gap-3">
							<div
								class="mask flex size-8 min-h-8 min-w-8 items-center justify-center bg-secondary/30 text-xs font-semibold mask-squircle"
							>
								{#if item.profile_image}
									<img
										src={getPreviewUrl() + item.profile_image}
										alt="Profile"
										onerror={(e) => {
											if (index == 0) {
												toast.warning(
													'Failed to load images. You may continue using the app without images.'
												);
											}
											e.currentTarget.classList.add('hidden');
											e.currentTarget.nextElementSibling?.classList.remove('hidden');
											e.currentTarget.nextElementSibling?.classList.add('flex');
										}}
									/>
									<div class=" hidden h-full w-full items-center justify-center">
										{item.firstname[0]}
									</div>
								{:else}
									<div class="flex h-full w-full items-center justify-center">
										{item.firstname[0]}
									</div>
								{/if}
							</div>
							<div class="line-clamp-2 min-w-0 font-medium">
								{parseName(item, true)}
							</div>
						</div>
					</td>

					<td class="hidden capitalize md:table-cell">{item.sex}</td>

					<td class="hidden md:table-cell">
						{date.formatDate({ date: item.birthdate, format: 'MMM dd, yyyy' })}
					</td>

					<td class="max-w-12 truncate">{parseAddress(item)}</td>

					<td class="hidden md:table-cell">{item.license_number ? item.license_number : '-'}</td>

					<td class="hidden md:table-cell"
						>{item.contact_number ? `${item.contact_number}` : '-'}</td
					>

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
						colspan="9999"
						class={[
							'py-10 text-center',
							data.authorized ? 'text-base-content/60' : 'text-error/80'
						]}
					>
						{!data.authorized ? `${data.message}` : `No violators match these filters.`}
					</td>
				</tr>
			{/each}
		{/snippet}
	</Table>
{/key}

<Pagination total={data.total_count} />

<ViolatorArchiveModal superform={archiveForm} archive_data={[...selected_rows]} />
<ViolatorRestoreModal superform={restoreForm} restore_data={[...selected_rows]} />
