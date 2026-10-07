<script lang="ts">
	import Ticket_RestoreModal from './Ticket_RestoreModal.svelte';
	import Ticket_WithdrawModal from './Ticket_WithdrawModal.svelte';
	import Ticket_ArchiveModal from './Ticket_ArchiveModal.svelte';
	import Ticket_EditModal from './Ticket_EditModal.svelte';
	import Ticket_AddModal from './Ticket_AddModal.svelte';
	import Pagination from '$lib/ui/components/pagination/Pagination.svelte';
	import RowActions, { type RowAction } from '$lib/ui/components/table/RowActions.svelte';
	import Table from '$lib/ui/components/table/Table.svelte';
	import type Ticket from '$lib/validation_schemas/Tickets.zod';
	import { toast } from 'svelte-sonner';
	import { superForm, type SuperForm } from 'sveltekit-superforms';
	import { date, parseName, permissions } from '$lib/utilities/helper';
	import { beforeNavigate } from '$app/navigation';
	import {
		Archive,
		CirclePlus,
		FileUp,
		Plus,
		RotateCcw,
		SquarePen,
		UserRoundPlus
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import Can from '$lib/ui/components/Can.svelte';
	import Permission from '$lib/validation_schemas/Permissions.zod.js';
	import Header from '$lib/ui/layout/header/Header.svelte';

	let { data } = $props();

	//#region forms

	const add_form: SuperForm<Ticket.Create, App.Superforms.Message> = superForm(data.createForm, {
		delayMs: 500,
		timeoutMs: 8000,
		dataType: 'json'
	});

	const edit_form: SuperForm<Ticket.Edit, App.Superforms.Message> = superForm(data.editForm, {
		delayMs: 500,
		timeoutMs: 8000,
		onResult: ({ result }) => {
			if (result.type == 'success') {
				(document.getElementById('ticket_edit') as HTMLDialogElement).close();
				selected_rows = new SvelteSet();
			}
		},
		dataType: 'json'
	});

	const withdraw_form: SuperForm<Ticket.Withdraw, App.Superforms.Message> = superForm(
		data.withdrawForm,
		{
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('ticket_withdraw') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			},
			dataType: 'json'
		}
	);

	const archive_form: SuperForm<Ticket.Archive, App.Superforms.Message> = superForm(
		data.archiveForm,
		{
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('ticket_archive') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			},
			dataType: 'json'
		}
	);

	const restore_form: SuperForm<Ticket.Restore, App.Superforms.Message> = superForm(
		data.restoreForm,
		{
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('ticket_restore') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			},
			dataType: 'json'
		}
	);

	[
		add_form.message,
		edit_form.message,
		withdraw_form.message,
		archive_form.message,
		restore_form.message
	].forEach((f) => {
		f.subscribe((m) => {
			if (m) {
				if (m.type == 'error') {
					toast.error(m.text);
				} else if (m.type == 'success') {
					toast.success(m.text);
				}
			}
		});
	});

	//#endregion

	//#region row selection

	let selected_rows = $state(new Set<Ticket.Base>());
	let archivable = $derived.by<boolean>((): boolean => {
		return [...selected_rows].some((item) => item.archived === false);
	});
	let withdrawable = $derived.by<boolean>((): boolean => {
		return [...selected_rows].every(
			(item) => !item.in_charge && !item.ticket_for && !item.date_withdrawn && !item.archived
		);
	});
	let editable = $derived.by<boolean>((): boolean => {
		return [...selected_rows].every(
			(item) => !item.in_charge && !item.ticket_for && !item.date_withdrawn && !item.archived
		);
	});

	const toggleRowSelect = (_d: Ticket.Base, checked: boolean) => {
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
			selected_rows = new SvelteSet(data.tickets.data);
		}
	};

	//#endregion

	//before navigate (pagination or filter) clear state values
	beforeNavigate(({ from, to }) => {
		if (from?.route.id !== to?.route.id) {
			selected_rows = new SvelteSet();
		}
	});

	let _p = permissions.get('tickets', data.user?.user_type.permissions);

	// no column at all for a role that can't do any of the row actions
	// (assigning is a link to the assignments page, which enforces its own permission)
	const can_assign = permissions.hasAccess('ticket_assignments', data.user?.user_type.permissions);
	const show_actions =
		_p.edit !== 'none' || _p.restore !== 'none' || _p.archive !== 'none' || can_assign;

	// row quick actions reuse the dialogs below, which act on the selection: select just this row
	// (it shows as checked, so it's clear who the dialog is about), then open the dialog
	const openForRow = (_d: Ticket.Base, dialog_id: string) => {
		selected_rows = new SvelteSet([_d]);
		(document.getElementById(dialog_id) as HTMLDialogElement)?.showModal();
	};

	const rowActions = (item: Ticket.Base): RowAction[] => {
		// same rule as the selection bar: only an unassigned, unwithdrawn, active ticket can be edited or withdrawn
		const untouched = !item.in_charge && !item.ticket_for && !item.date_withdrawn && !item.archived;

		return [
			untouched && _p.edit !== 'none'
				? {
						tip: 'Edit',
						label: `Edit ${item.name}`,
						icon: SquarePen,
						tone: 'info',
						onclick: () => openForRow(item, 'ticket_edit')
					}
				: null,
			untouched
				? {
						tip: 'Withdraw',
						label: `Withdraw ${item.name}`,
						icon: FileUp,
						tone: 'warning',
						onclick: () => openForRow(item, 'ticket_withdraw')
					}
				: null,
			// only a withdrawn ticket is sliced into assignments; the page also manages the ones it already has
			can_assign && !!item.date_withdrawn && !item.archived
				? {
						tip: 'Assignments',
						label: `Manage assignments of ${item.name}`,
						icon: UserRoundPlus,
						tone: 'success',
						href: resolve(`/u/ticket-assignments/${item._id}/edit`)
					}
				: null,
			item.archived
				? _p.restore !== 'none'
					? {
							tip: 'Restore',
							label: `Restore ${item.name}`,
							icon: RotateCcw,
							tone: 'success',
							onclick: () => openForRow(item, 'ticket_restore')
						}
					: null
				: _p.archive !== 'none'
					? {
							tip: 'Archive',
							label: `Archive ${item.name}`,
							icon: Archive,
							tone: 'error',
							onclick: () => openForRow(item, 'ticket_archive')
						}
					: null
		];
	};
</script>

<Header title="Registered Tickets">
	{#snippet AddButtons()}
		<Can
			permissions={data.user.user_type.permissions}
			action={Permission.Actions.CREATE}
			route="tickets"
		>
			<button
				type="button"
				class="btn hidden h-10 w-20 border-0 capitalize shadow-none btn-sm btn-primary md:flex"
				onclick={() => (document.getElementById('ticket_add') as HTMLDialogElement)?.showModal()}
			>
				<CirclePlus class="size-4" />
				<span class="pr-0.5">Add</span>
			</button>
			<div class="fab bottom-24 block md:hidden">
				<button
					class="btn btn-circle size-12 p-0 btn-primary"
					onclick={() => (document.getElementById('ticket_add') as HTMLDialogElement)?.showModal()}
					><Plus class="size-5" />
				</button>
			</div>
		</Can>
	{/snippet}
</Header>

<div class="flex w-full flex-row justify-between gap-4 px-6 py-2">
	<div class="invisible flex flex-row items-center gap-2" class:visible={selected_rows.size}>
		<p class="truncate text-sm">
			{selected_rows.size}
			{selected_rows.size > 1 ? 'rows' : 'row'} selected
		</p>

		{#if selected_rows.size == 1 && editable}
			<Can
				permissions={data.user.user_type.permissions}
				action={Permission.Actions.EDIT}
				route="tickets"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-info"
					type="button"
					onclick={() => (document.getElementById('ticket_edit') as HTMLDialogElement)?.showModal()}
				>
					<SquarePen class=" size-4" />edit
				</button>
			</Can>
		{/if}

		{#if withdrawable}
			<button
				class="btn capitalize btn-soft btn-xs btn-primary"
				type="button"
				onclick={() =>
					(document.getElementById('ticket_withdraw') as HTMLDialogElement)?.showModal()}
			>
				<FileUp class=" size-4" />{selected_rows.size > 1 ? 'bulk' : ''} withdraw
			</button>
		{/if}

		{#if archivable}
			<Can
				permissions={data.user.user_type.permissions}
				action={Permission.Actions.ARCHIVE}
				route="tickets"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-error"
					type="button"
					onclick={() =>
						(document.getElementById('ticket_archive') as HTMLDialogElement)?.showModal()}
				>
					<Archive class=" size-4" />{selected_rows.size > 1 ? 'bulk' : ''} archive
				</button>
			</Can>
		{:else}
			<Can
				permissions={data.user.user_type.permissions}
				action={Permission.Actions.RESTORE}
				route="tickets"
			>
				<button
					class="btn capitalize btn-soft btn-xs btn-success"
					type="button"
					onclick={() =>
						(document.getElementById('ticket_restore') as HTMLDialogElement)?.showModal()}
				>
					<RotateCcw class=" size-4" />{selected_rows.size > 1 ? 'bulk' : ''} restore
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
					aria-label="Select all tickets on this page"
					indeterminate={selected_rows.size > 0 && selected_rows.size < data.tickets.data.length}
					checked={data.tickets.data.length > 0 && selected_rows.size == data.tickets.data.length}
				/></th
			>
			<th>Ticket name</th>
			<th colspan="2">Ticket series</th>
			<th>Date created</th>
			<th>Ticket for</th>
			<th>Person in-charge</th>
			<th>Date withdrawn</th>
			<th>Status</th>
			{#if show_actions}
				<th class="w-0"><span class="sr-only">Actions</span></th>
			{/if}
		{/snippet}

		{#snippet table_subHeader()}
			<tr class="text-xs">
				<th></th>
				<th></th>
				<th>From</th>
				<th>To</th>
				<th></th>
				<th></th>
				<th></th>
				<th></th>
				<th></th>
				{#if show_actions}
					<th></th>
				{/if}
			</tr>
		{/snippet}

		{#snippet table_body()}
			{#each data.tickets.data as item, index (index)}
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
					<td>{item.ticket_num_from}</td>
					<td>{item.ticket_num_to}</td>
					<td>{date.formatDate({ date: item.date_created, format: 'MMM d, yyyy' })}</td>
					<td>{item.ticket_for ? item.ticket_for?.name : '-'}</td>
					<td>{item.in_charge ? parseName(item.in_charge, true) : '-'}</td>
					<td
						>{item.date_withdrawn
							? date.formatDate({ date: item.date_withdrawn, format: 'MMM d, yyyy' })
							: '-'}</td
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
						colspan={show_actions ? 10 : 9}
						class={[
							'py-10 text-center',
							data.authorized ? 'text-base-content/60' : 'text-error/80'
						]}
					>
						{!data.authorized ? `${data.message}` : `No tickets match these filters.`}
					</td>
				</tr>
			{/each}
		{/snippet}
	</Table>
{/key}

<Pagination total={data.total_count} />

<Ticket_AddModal superform={add_form} />
<Ticket_EditModal superform={edit_form} edit_data={[...selected_rows][0]} />
<Ticket_WithdrawModal superform={withdraw_form} edit_data={[...selected_rows]} />
<Ticket_ArchiveModal superform={archive_form} archive_data={[...selected_rows]} />
<Ticket_RestoreModal superform={restore_form} restore_data={[...selected_rows]} />
