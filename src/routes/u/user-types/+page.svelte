<script lang="ts">
	import UserType_RestoreModal from './UserType_RestoreModal.svelte';
	import UserType_ArchiveModal from './UserType_ArchiveModal.svelte';
	import RowActions, { type RowAction } from '$lib/ui/components/table/RowActions.svelte';
	import Table from '$lib/ui/components/table/Table.svelte';
	import { permissions } from '$lib/utilities/helper';
	import Pagination from '$lib/ui/components/pagination/Pagination.svelte';
	import { superForm, type SuperForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { Archive, CirclePlus, Plus, RotateCcw, SquarePen } from '@lucide/svelte';
	import { beforeNavigate } from '$app/navigation';
	import type UserType from '$lib/validation_schemas/UserTypes.zod.js';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import User from '$lib/validation_schemas/Users.zod.js';
	import EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod.js';
	import Can from '$lib/ui/components/Can.svelte';
	import Permission from '$lib/validation_schemas/Permissions.zod.js';

	//#region variables
	let { data } = $props();

	//#endregion

	//#region forms

	const archive_form: SuperForm<UserType.Archive, App.Superforms.Message> = superForm(
		data.archiveForm,
		{
			dataType: 'json',
			delayMs: 500,
			timeoutMs: 8000,
			onResult({ result }) {
				if (result.type == 'success') {
					selected_rows = new SvelteSet();
					(document.getElementById('user_type_archive') as HTMLDialogElement).close();
				}
			}
		}
	);

	const restore_form: SuperForm<UserType.Restore, App.Superforms.Message> = superForm(
		data.restoreForm,
		{
			dataType: 'json',
			delayMs: 500,
			timeoutMs: 8000,
			onResult({ result }) {
				if (result.type == 'success') {
					selected_rows = new SvelteSet();
					(document.getElementById('user_type_restore') as HTMLDialogElement).close();
				}
			}
		}
	);

	//#endregion

	//#region form messages (add, edit, archive)

	[archive_form, restore_form].forEach((f) =>
		f.message.subscribe((m) => {
			if (m) {
				if (m.type == 'error') {
					toast.error(m.text);
				} else if (m?.type == 'success') {
					toast.success(m.text);
				}
			}
		})
	);

	//#endregion

	//#region row selection block

	let selected_rows = $state(new Set<UserType.Base>());
	let archiveable = $derived.by(() => [...selected_rows].some((item) => item.archived === false));

	const toggleRowSelect = (_d: UserType.Base, checked: boolean) => {
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
			selected_rows = new SvelteSet(data.user_types.data);
		}
	};

	//#endregion

	beforeNavigate(() => {
		selected_rows = new SvelteSet();
	});

	let _p = permissions.get('user_types', data.user?.user_type.permissions);

	// no column at all for a role that can't do any of the row actions
	const show_actions = _p.edit !== 'none' || _p.restore !== 'none' || _p.archive !== 'none';

	// row quick actions reuse the dialogs below, which act on the selection: select just this row
	// (it shows as checked, so it's clear who the dialog is about), then open the dialog
	const openForRow = (_d: UserType.Base, dialog_id: string) => {
		selected_rows = new SvelteSet([_d]);
		(document.getElementById(dialog_id) as HTMLDialogElement)?.showModal();
	};

	const rowActions = (item: UserType.Base): RowAction[] => [
		_p.edit !== 'none'
			? {
					tip: 'Edit',
					label: `Edit ${item.user_type}`,
					icon: SquarePen,
					tone: 'info',
					href: resolve(`/u/user-types/${item._id}/edit`)
				}
			: null,
		item.archived
			? _p.restore !== 'none'
				? {
						tip: 'Restore',
						label: `Restore ${item.user_type}`,
						icon: RotateCcw,
						tone: 'success',
						onclick: () => openForRow(item, 'user_type_restore')
					}
				: null
			: _p.archive !== 'none'
				? {
						tip: 'Archive',
						label: `Archive ${item.user_type}`,
						icon: Archive,
						tone: 'error',
						onclick: () => openForRow(item, 'user_type_archive')
					}
				: null
	];
</script>

<Header title="User Types">
	{#snippet AddButtons()}
		<Can
			permissions={data.user?.user_type.permissions}
			action={Permission.Actions.CREATE}
			route="user_types"
		>
			<a
				type="button"
				class="btn hidden h-10 w-20 border-0 capitalize shadow-none btn-sm btn-primary md:flex"
				href={resolve('/u/user-types/create')}
			>
				<CirclePlus class="size-4" />
				<span class="pr-0.5">Add</span>
			</a>

			<div class="fab bottom-24 block md:hidden">
				<a class="btn btn-circle size-12 p-0 btn-primary" href={resolve('/u/user-types/create')}>
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
				route="user_types"
			>
				<a
					class="btn capitalize btn-soft btn-xs btn-info"
					href={resolve(`/u/user-types/${[...selected_rows][0]._id}/edit`)}
				>
					<SquarePen class=" size-4" />edit
				</a>
			</Can>
		{/if}

		{#if !archiveable}
			<Can
				permissions={data.user?.user_type.permissions}
				action={Permission.Actions.RESTORE}
				route="user_types"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-success"
					type="button"
					onclick={() =>
						(document.getElementById('user_type_restore') as HTMLDialogElement)?.showModal()}
				>
					<RotateCcw class=" size-4" />{selected_rows.size > 1 ? 'bulk' : ''} restore
				</button>
			</Can>
		{:else}
			<Can
				permissions={data.user?.user_type.permissions}
				action={Permission.Actions.ARCHIVE}
				route="user_types"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-error"
					type="button"
					onclick={() =>
						(document.getElementById('user_type_archive') as HTMLDialogElement)?.showModal()}
				>
					<Archive class=" size-4" />{selected_rows.size > 1 ? 'bulk' : ''} archive
				</button>
			</Can>
		{/if}
	</div>
</div>

{#key data.user_types.data}
	<Table>
		{#snippet table_header()}
			<th class="w-4"
				><input
					type="checkbox"
					class="checkbox checkbox-xs"
					onchange={(e) => toggleRowSelectAll(!e.currentTarget.checked)}
					aria-label="Select all user types on this page"
					indeterminate={selected_rows.size > 0 && selected_rows.size < data.user_types.data.length}
					checked={data.user_types.data.length > 0 &&
						selected_rows.size == data.user_types.data.length}
				/></th
			>
			<th>User type</th>
			<th>Role</th>
			<th>Status</th>
			{#if show_actions}
				<th class="w-0"><span class="sr-only">Actions</span></th>
			{/if}
		{/snippet}

		{#snippet table_body()}
			{#each data.user_types.data as item, index (index)}
				<tr class={['has-[input:checked]:bg-primary/10', item.archived && 'text-base-content/50']}>
					<td>
						<input
							type="checkbox"
							class="checkbox checkbox-xs"
							aria-label={`Select ${item.user_type}`}
							onchange={(e) => toggleRowSelect(item, e.currentTarget.checked)}
							checked={[...selected_rows].some((i) => i._id == item._id)}
						/></td
					>
					<td>{item.user_type}</td>
					<td class="truncate"><span class="line-clamp-2">{item.role}</span></td>
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
						colspan={show_actions ? 5 : 4}
						class={[
							'py-10 text-center',
							data.authorized ? 'text-base-content/60' : 'text-error/80'
						]}
					>
						{!data.authorized ? `${data.message}` : `No user types match these filters.`}
					</td>
				</tr>
			{/each}
		{/snippet}
	</Table>
{/key}

<Pagination total={data.total_count} />

<UserType_ArchiveModal
	superform={archive_form}
	archive_data={[...selected_rows] as UserType.Base[]}
/>
<UserType_RestoreModal
	superform={restore_form}
	restore_data={[...selected_rows] as UserType.Base[]}
/>
