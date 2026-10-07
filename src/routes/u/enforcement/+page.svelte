<script lang="ts">
	import Group_RestoreModal from './Group_RestoreModal.svelte';
	import Group_ArchiveModal from './Group_ArchiveModal.svelte';
	import Group_EditModal from './Group_EditModal.svelte';
	import Group_AddModal from './Group_AddModal.svelte';
	import Group_IncentiveModal from './Group_IncentiveModal.svelte';
	import { describeRate } from '$lib/utilities/incentives';
	import RowActions, { type RowAction } from '$lib/ui/components/table/RowActions.svelte';
	import Table from '$lib/ui/components/table/Table.svelte';
	import { permissions } from '$lib/utilities/helper';
	import Pagination from '$lib/ui/components/pagination/Pagination.svelte';
	import { superForm, type SuperForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { Archive, CirclePlus, HandCoins, Plus, RotateCcw, SquarePen } from '@lucide/svelte';
	import { beforeNavigate } from '$app/navigation';
	import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod.js';
	import { SvelteSet } from 'svelte/reactivity';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import Can from '$lib/ui/components/Can.svelte';
	import Permission from '$lib/validation_schemas/Permissions.zod';

	let { data } = $props();

	//#region forms
	const form: SuperForm<EnforcementGroup.Create, App.Superforms.Message> = superForm(
		data.createForm,
		{
			delayMs: 500,
			timeoutMs: 8000
		}
	);

	const edit_form: SuperForm<EnforcementGroup.Edit, App.Superforms.Message> = superForm(
		data.editForm,
		{
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('group_edit') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			}
		}
	);

	const archive_form: SuperForm<EnforcementGroup.Archive, App.Superforms.Message> = superForm(
		data.archiveForm,
		{
			dataType: 'json',
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('group_archive') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			}
		}
	);

	const restore_form: SuperForm<EnforcementGroup.Restore, App.Superforms.Message> = superForm(
		data.restoreForm,
		{
			dataType: 'json',
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('group_restore') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			}
		}
	);

	const incentive_form: SuperForm<EnforcementGroup.Incentive, App.Superforms.Message> = superForm(
		data.incentiveForm,
		{
			dataType: 'json',
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('group_incentive') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			}
		}
	);

	[
		form.message,
		edit_form.message,
		archive_form.message,
		restore_form.message,
		incentive_form.message
	].forEach((f) =>
		f.subscribe((m) => {
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

	//#region row selection

	let selected_rows = $state(new Set<EnforcementGroup.Base>());
	let archiveable = $derived.by(() => [...selected_rows].some((item) => item.archived === false));

	const toggleRowSelect = (_d: EnforcementGroup.Base, checked: boolean) => {
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
			selected_rows = new SvelteSet(data.enforcement_group.data);
		}
	};

	//#endregion

	//before navigate (pagination or filter) clear state values
	beforeNavigate(() => {
		selected_rows = new SvelteSet();
	});

	let _p = permissions.get('enforcement_groups', data.user?.user_type.permissions);

	const can_set_incentive =
		permissions.get('incentives', data.user?.user_type.permissions).edit !== 'none';

	// no column at all for a role that can't do any of the row actions
	const show_actions =
		_p.edit !== 'none' || _p.restore !== 'none' || _p.archive !== 'none' || can_set_incentive;

	const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

	// the incentive dialog edits the row's saved settings, starting from sensible defaults when unset
	let incentive_group_name = $state('');
	const openIncentive = (item: EnforcementGroup.Base) => {
		selected_rows = new SvelteSet([item]);
		incentive_group_name = item.name;
		incentive_form.reset({
			data: {
				_id: item._id,
				enabled: item.incentive?.enabled ?? true,
				rate_type: item.incentive?.rate_type ?? 'percentage',
				amount: item.incentive?.amount ?? 0,
				basis: item.incentive?.basis ?? 'paid'
			}
		});
		(document.getElementById('group_incentive') as HTMLDialogElement)?.showModal();
	};

	// row quick actions reuse the dialogs below, which act on the selection: select just this row
	// (it shows as checked, so it's clear who the dialog is about), then open the dialog
	const openForRow = (_d: EnforcementGroup.Base, dialog_id: string) => {
		selected_rows = new SvelteSet([_d]);
		(document.getElementById(dialog_id) as HTMLDialogElement)?.showModal();
	};

	const rowActions = (item: EnforcementGroup.Base): RowAction[] => [
		_p.edit !== 'none'
			? {
					tip: 'Edit',
					label: `Edit ${item.name}`,
					icon: SquarePen,
					tone: 'info',
					onclick: () => openForRow(item, 'group_edit')
				}
			: null,
		can_set_incentive
			? {
					tip: 'Incentives',
					label: `Incentive settings for ${item.name}`,
					icon: HandCoins,
					tone: 'success',
					onclick: () => openIncentive(item)
				}
			: null,
		item.archived
			? _p.restore !== 'none'
				? {
						tip: 'Restore',
						label: `Restore ${item.name}`,
						icon: RotateCcw,
						tone: 'success',
						onclick: () => openForRow(item, 'group_restore')
					}
				: null
			: _p.archive !== 'none'
				? {
						tip: 'Archive',
						label: `Archive ${item.name}`,
						icon: Archive,
						tone: 'error',
						onclick: () => openForRow(item, 'group_archive')
					}
				: null
	];
</script>

<Header title="Enforcement Groups">
	{#snippet AddButtons()}
		<Can
			permissions={data.user.user_type.permissions}
			action={Permission.Actions.CREATE}
			route="enforcement_groups"
		>
			<button
				type="button"
				class="btn hidden h-10 w-20 border-0 capitalize shadow-none btn-sm btn-primary md:flex"
				onclick={() => (document.getElementById('group_add') as HTMLDialogElement)?.showModal()}
			>
				<CirclePlus class="size-4" />
				<span class="pr-0.5">Add</span>
			</button>

			<div class="fab bottom-24 block md:hidden">
				<button
					class="btn btn-circle size-12 p-0 btn-primary"
					onclick={() => (document.getElementById('group_add') as HTMLDialogElement)?.showModal()}
				>
					<Plus class="size-5" />
				</button>
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
				permissions={data.user.user_type.permissions}
				action={Permission.Actions.EDIT}
				route="enforcement_groups"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-info"
					type="button"
					onclick={() => (document.getElementById('group_edit') as HTMLDialogElement)?.showModal()}
				>
					<SquarePen class=" size-4" />edit
				</button>
			</Can>
		{/if}

		{#if !archiveable}
			<Can
				permissions={data.user.user_type.permissions}
				action={Permission.Actions.RESTORE}
				route="enforcement_groups"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-success"
					type="button"
					onclick={() =>
						(document.getElementById('group_restore') as HTMLDialogElement)?.showModal()}
				>
					<RotateCcw class=" size-4" />{selected_rows.size > 1 ? 'bulk' : ''} restore
				</button>
			</Can>
		{:else}
			<Can
				permissions={data.user.user_type.permissions}
				action={Permission.Actions.ARCHIVE}
				route="enforcement_groups"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-error"
					type="button"
					onclick={() =>
						(document.getElementById('group_archive') as HTMLDialogElement)?.showModal()}
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
					aria-label="Select all groups on this page"
					indeterminate={selected_rows.size > 0 &&
						selected_rows.size < data.enforcement_group.data.length}
					checked={data.enforcement_group.data.length > 0 &&
						selected_rows.size == data.enforcement_group.data.length}
				/></th
			>
			<th>Group name</th>
			<th>Description</th>
			<th class="hidden md:table-cell">Incentive</th>
			<th>Status</th>
			{#if show_actions}
				<th class="w-0"><span class="sr-only">Actions</span></th>
			{/if}
		{/snippet}

		{#snippet table_body()}
			{#each data.enforcement_group.data as item, index (index)}
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
					<td>{item.name}</td>
					<td>{item.description}</td>
					<td class="hidden md:table-cell">
						{#if item.incentive}
							<span class={[!item.incentive.enabled && 'text-base-content/50']}>
								{describeRate(item.incentive, peso)}{item.incentive.enabled ? '' : ' (off)'}
							</span>
							<span class="block text-xs text-base-content/60">
								{item.incentive.basis === 'paid' ? 'Paid tickets' : 'Issued tickets'}
							</span>
						{:else}
							<span class="text-base-content/50">Not set</span>
						{/if}
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
						{!data.authorized ? `${data.message}` : `No groups match these filters.`}
					</td>
				</tr>
			{/each}
		{/snippet}
	</Table>
{/key}

<Pagination total={data.total_count} />

<Group_AddModal superform={form} />
<Group_EditModal superform={edit_form} edit_data={[...selected_rows][0] as EnforcementGroup.Base} />
<Group_ArchiveModal
	superform={archive_form}
	archive_data={[...selected_rows] as EnforcementGroup.Base[]}
/>
<Group_RestoreModal
	superform={restore_form}
	restore_data={[...selected_rows] as EnforcementGroup.Base[]}
/>
<Group_IncentiveModal superform={incentive_form} group_name={incentive_group_name} />
