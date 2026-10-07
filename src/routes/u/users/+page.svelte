<script lang="ts">
	import User_RestoreModal from './User_RestoreModal.svelte';
	import User_ArchiveModal from './User_ArchiveModal.svelte';
	import User_ResetPasswordModal from './User_ResetPasswordModal.svelte';
	import Pagination from '$lib/ui/components/pagination/Pagination.svelte';
	import RowActions, { type RowAction } from '$lib/ui/components/table/RowActions.svelte';
	import Table from '$lib/ui/components/table/Table.svelte';
	import { beforeNavigate } from '$app/navigation';
	import { Archive, CirclePlus, KeyRound, RotateCcw, SquarePen } from '@lucide/svelte';
	import { getPreviewUrl, permissions } from '$lib/utilities/helper.js';
	import { superForm, type SuperForm } from 'sveltekit-superforms';
	import { toast, Toaster } from 'svelte-sonner';
	import type User from '$lib/validation_schemas/Users.zod.js';
	import { SvelteSet } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import Can from '$lib/ui/components/Can.svelte';
	import Filter from '$lib/ui/components/table/Filter.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import Permission from '$lib/validation_schemas/Permissions.zod.js';
	import { Plus } from '@lucide/svelte';
	import UserFormModal from './UserFormModal.svelte';

	let { data } = $props();

	let _p = permissions.get('users', data.user?.user_type.permissions);
	let created_credentials = $state<{ username: string; password: string } | null>(null);
	let credentials_mode = $state<'created' | 'reset'>('created');

	//#region forms

	// sent as plain form data (not json) so the photo in the file input goes with it
	const _create_form: SuperForm<User.Create, App.Superforms.Message> = superForm(data.create_form, {
		delayMs: 500,
		timeoutMs: 8000,
		onResult: ({ result }) => {
			if (result.type == 'success' && result.data) {
				const { username, password } = result.data.form.message.data;
				if (username && password) {
					(document.getElementById('users_create') as HTMLDialogElement).close();
					created_credentials = { username, password };
					credentials_mode = 'created';
					(document.getElementById('users_credentials') as HTMLDialogElement).showModal();
				}
			}
		}
	});

	const editForm: SuperForm<User.Edit, App.Superforms.Message> = superForm(data.edit_form, {
		delayMs: 500,
		timeoutMs: 8000,
		onResult: ({ result }) => {
			if (result.type == 'success') {
				(document.getElementById('users_edit') as HTMLDialogElement).close();
				selected_rows = new SvelteSet();
			}
		}
	});

	// only set when the edit modal is opened, so selecting a row doesn't fetch it for editing
	let editing = $state<User.Base>();

	const openEdit = (_d: User.Base) => {
		editing = _d;
		openForRow(_d, 'users_edit');
	};

	const archiveForm: SuperForm<User.Archive, App.Superforms.Message> = superForm(
		data.archive_form,
		{
			dataType: 'json',
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('users_archive') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			}
		}
	);

	const restoreForm: SuperForm<User.Restore, App.Superforms.Message> = superForm(
		data.restore_form,
		{
			dataType: 'json',
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success') {
					(document.getElementById('users_restore') as HTMLDialogElement).close();
					selected_rows = new SvelteSet();
				}
			}
		}
	);

	const resetPasswordForm: SuperForm<User.ResetPassword, App.Superforms.Message> = superForm(
		data.reset_password_form,
		{
			dataType: 'json',
			delayMs: 500,
			timeoutMs: 8000,
			onResult: ({ result }) => {
				if (result.type == 'success' && result.data) {
					const { username, password } = result.data.form.message.data;
					(document.getElementById('users_reset_password') as HTMLDialogElement).close();
					if (username && password) {
						created_credentials = { username, password };
						credentials_mode = 'reset';
						(document.getElementById('users_credentials') as HTMLDialogElement).showModal();
					}
					selected_rows = new SvelteSet();
				}
			}
		}
	);
	//#endregion

	//#region row selection block

	let selected_rows = $state(new Set<User.Base>());
	let archiveable = $derived.by(() => [...selected_rows].some((item) => item.archived === false));

	const toggleRowSelect = (_d: User.Base, checked: boolean) => {
		if (checked) selected_rows.add(_d);
		else selected_rows.delete(_d);

		selected_rows = new SvelteSet(selected_rows);
	};

	const toggleRowSelectAll = (checked: boolean) => {
		if (checked) selected_rows = new SvelteSet();
		else selected_rows = new SvelteSet(data.users.data);
	};

	// no column at all for a role that can't do any of the row actions
	const show_actions = _p.edit !== 'none' || _p.restore !== 'none' || _p.archive !== 'none';

	// row quick actions reuse the modals above, which act on the selection: select just this row
	// (it shows as checked, so it's clear who the dialog is about), then open the dialog
	const openForRow = (_d: User.Base, dialog_id: string) => {
		selected_rows = new SvelteSet([_d]);
		(document.getElementById(dialog_id) as HTMLDialogElement).showModal();
	};

	const rowActions = (item: User.Base): RowAction[] => [
		_p.edit !== 'none'
			? {
					tip: 'Edit',
					label: `Edit ${item.firstname} ${item.lastname}`,
					icon: SquarePen,
					tone: 'info',
					onclick: () => openEdit(item)
				}
			: null,
		_p.edit !== 'none' && !item.archived
			? {
					tip: 'Change password',
					label: `Change password for ${item.firstname} ${item.lastname}`,
					icon: KeyRound,
					tone: 'warning',
					onclick: () => openForRow(item, 'users_reset_password')
				}
			: null,
		item.archived
			? _p.restore !== 'none'
				? {
						tip: 'Restore',
						label: `Restore ${item.firstname} ${item.lastname}`,
						icon: RotateCcw,
						tone: 'success',
						onclick: () => openForRow(item, 'users_restore')
					}
				: null
			: _p.archive !== 'none'
				? {
						tip: 'Archive',
						label: `Archive ${item.firstname} ${item.lastname}`,
						icon: Archive,
						tone: 'error',
						onclick: () => openForRow(item, 'users_archive')
					}
				: null
	];

	beforeNavigate(() => {
		selected_rows = new SvelteSet();
	});

	function copy_all() {
		if (!created_credentials) return;
		const text = `Username: ${created_credentials.username}\nPassword: ${created_credentials.password}`;
		navigator.clipboard.writeText(text);
		toast.success('Credentials copied');
		(document.getElementById('users_credentials') as HTMLDialogElement).close();
	}

	//#endregion
</script>

<Header title="User Profiles">
	{#snippet AddButtons()}
		<Can
			permissions={data.user?.user_type.permissions}
			action={Permission.Actions.CREATE}
			route="users"
		>
			<button
				type="button"
				class="btn hidden h-10 w-20 border-0 capitalize shadow-none btn-sm btn-primary md:flex"
				onclick={() => (document.getElementById('users_create') as HTMLDialogElement).showModal()}
			>
				<CirclePlus class="size-4" />
				<span class="pr-0.5">Add</span>
			</button>

			<div class="fab bottom-24 block md:hidden">
				<button
					type="button"
					class="btn btn-circle size-12 p-0 btn-primary"
					aria-label="Add user"
					onclick={() => (document.getElementById('users_create') as HTMLDialogElement).showModal()}
				>
					<Plus class="size-5" />
				</button>
			</div>
		</Can>
	{/snippet}

	{#snippet PropFilter()}
		<Filter filters={['enforcement_group', 'user_type', 'login']}></Filter>
	{/snippet}
</Header>

<div class="flex w-full flex-row justify-between gap-4 px-6 py-2">
	<div class="invisible flex flex-row items-center gap-2" class:visible={selected_rows.size}>
		<p class="text-xs md:text-sm">
			{selected_rows.size}
			{selected_rows.size > 1 ? 'rows' : 'row'} selected
		</p>

		{#if selected_rows.size == 1 && _p.edit !== 'none'}
			<button
				type="button"
				onclick={() => openEdit([...selected_rows][0])}
				class="btn capitalize btn-soft btn-xs btn-info"><SquarePen class=" size-4" />edit</button
			>

			<button
				class="btn capitalize btn-soft btn-xs btn-warning"
				onclick={() => {
					(document.getElementById('users_reset_password') as HTMLDialogElement).showModal();
				}}
				type="button"
			>
				<KeyRound class=" size-4" />change password
			</button>
		{/if}

		{#if !archiveable && _p.restore !== 'none'}
			<button
				class="btn capitalize btn-soft btn-xs btn-success"
				onclick={() => {
					(document.getElementById('users_restore') as HTMLDialogElement).showModal();
				}}
				type="button"
			>
				<RotateCcw class=" size-4" />{selected_rows.size > 1 ? 'bulk' : ''} restore
			</button>
		{:else if _p.archive !== 'none'}
			<button
				class="btn capitalize btn-soft btn-xs btn-error"
				onclick={() => {
					(document.getElementById('users_archive') as HTMLDialogElement).showModal();
				}}
				type="button"
			>
				<Archive class=" size-4" />{selected_rows.size > 1 ? 'bulk' : ''} archive
			</button>
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
					aria-label="Select all users on this page"
					indeterminate={selected_rows.size > 0 && selected_rows.size < data.users.data.length}
					checked={data.users.data.length > 0 && selected_rows.size == data.users.data.length}
				/>
			</th>
			<th>Name</th>
			<th class="hidden md:table-cell">Group</th>
			<th>User type</th>
			<th>Status</th>
			<th class="hidden md:table-cell">Last login</th>
			{#if show_actions}
				<th class="w-0"><span class="sr-only">Actions</span></th>
			{/if}
		{/snippet}

		{#snippet table_body()}
			{#each data.users.data as item, index (index)}
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
											if (index == 0)
												toast.warning(
													'Failed to load images. You may continue using the app without images.'
												);
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
							<div class="flex min-w-0 flex-col">
								<a
									href={resolve(`/u/users/${item._id}`)}
									class="line-clamp-2 font-medium hover:underline focus-visible:outline-2 focus-visible:outline-primary"
								>
									{item.firstname}
									{item.lastname}
								</a>
								<span class="truncate text-xs normal-case text-base-content/60"
									>{item.username}</span
								>
							</div>
						</div>
					</td>
					<td class="hidden md:table-cell">
						<span class="line-clamp-2">{item.enforcement_group.name}</span>
					</td>
					<td>{item.user_type.user_type}</td>
					<td>
						{#if item.archived}
							<span class="badge badge-ghost badge-sm">Archived</span>
						{:else}
							<span class="badge badge-soft badge-sm badge-success">Active</span>
						{/if}
					</td>
					<td class="hidden whitespace-nowrap normal-case md:table-cell">
						{#if item.last_login}
							{new Date(item.last_login).toLocaleString('en-PH', {
								dateStyle: 'medium',
								timeStyle: 'short',
								timeZone: 'Asia/Manila'
							})}
						{:else}
							<span class="text-base-content/50">No login yet</span>
						{/if}
					</td>
					{#if show_actions}
						<td><RowActions actions={rowActions(item)} /></td>
					{/if}
				</tr>
			{:else}
				<tr>
					<td
						colspan={show_actions ? 7 : 6}
						class={[
							'py-10 text-center',
							data.authorized ? 'text-base-content/60' : 'text-error/80'
						]}
					>
						{!data.authorized ? `${data.message}` : `No users match these filters.`}
					</td>
				</tr>
			{/each}
		{/snippet}
	</Table>
{/key}

<Pagination total={Number(data.total_count)} />

<User_ArchiveModal superform={archiveForm} archive_data={[...selected_rows]} />
<User_RestoreModal superform={restoreForm} restore_data={[...selected_rows]} />
<UserFormModal mode="create" superform={_create_form} />
<UserFormModal mode="edit" superform={editForm} user={editing} />
<User_ResetPasswordModal
	superform={resetPasswordForm}
	user_data={selected_rows.size == 1 ? [...selected_rows][0] : undefined}
/>

<dialog id="users_credentials" class="modal p-2 backdrop-blur-xs">
	<Toaster position="top-center" richColors />

	<div class="relative modal-box flex w-full flex-col gap-4 max-w-lg">
		<h3 class="font-bold text-success">
			{credentials_mode == 'created' ? 'User created' : 'Password reset'}
		</h3>

		<p class="text-sm">
			Share these with the user — they'll be asked to change the password on next login.
		</p>

		{#if created_credentials}
			<fieldset class="fieldset bg-base-300 py-3 px-4">
				<legend class="fieldset-legend label">Username</legend>
				<span class="text-2xl font-bold text-success font-mono">{created_credentials.username}</span
				>
			</fieldset>

			<fieldset class="fieldset bg-base-300 py-3 px-4">
				<legend class="fieldset-legend label">Password</legend>
				<span class="text-2xl font-bold text-success font-mono">{created_credentials.password}</span
				>
			</fieldset>
		{/if}

		<div class="modal-action mt-0">
			<button
				class="btn btn-ghost"
				type="button"
				onclick={() => (document.getElementById('users_credentials') as HTMLDialogElement).close()}
				>Close</button
			>
			<button class="btn btn-primary" type="button" onclick={() => copy_all()}> Copy </button>
		</div>
	</div>
</dialog>
