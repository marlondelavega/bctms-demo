<script lang="ts">
	import { resolve } from '$app/paths';
	import type { SelectItems } from '$lib/types/T_select_options';
	import Dropzone from '$lib/ui/components/dropzone/Dropzone.svelte';
	import Combo from '$lib/ui/components/input/Combo.svelte';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import { parseSelectItems } from '$lib/utilities/helper';
	import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
	import type UserType from '$lib/validation_schemas/UserTypes.zod';
	import type User from '$lib/validation_schemas/Users.zod';
	import { X } from '@lucide/svelte';
	import { onMount, untrack } from 'svelte';
	import { toast, Toaster } from 'svelte-sonner';
	import type { SuperForm } from 'sveltekit-superforms/client';

	type FullUser = User.Base<EnforcementGroup.Base, UserType.Base>;

	let {
		mode,
		superform,
		user
	}: {
		mode: 'create' | 'edit';
		superform:
			SuperForm<User.Create, App.Superforms.Message> | SuperForm<User.Edit, App.Superforms.Message>;
		/** edit mode: the row being edited; its latest data is fetched when it changes */
		user?: User.Base;
	} = $props();

	// both schemas share every field rendered here (edit only adds `_id`), so one typed view serves both
	const { form, errors, enhance, constraints, message, delayed, tainted, isTainted, reset } =
		superform as unknown as SuperForm<User.Edit, App.Superforms.Message>;

	const uid = $props.id();
	const dialog_id = $derived(mode === 'create' ? 'users_create' : 'users_edit');
	let dialog: HTMLDialogElement;

	let photo = $state<FileList | null>(null);
	let photo_error = $state<string | null>(null);

	//#region edit: the record being edited

	let record = $state<FullUser | null>(null);
	let loading = $state(false);

	const loadUser = async (id: string) => {
		loading = true;
		try {
			const res = await fetch(resolve(`/api/users/${id}`));
			const fresh: FullUser | null = res.ok ? (await res.json()).data : null;

			if (!fresh) {
				toast.error('This user could not be loaded. Try again.');
				dialog.close();
				return;
			}

			record = fresh;
			seedOptions();
			// the saved values become the baseline, so "unsaved changes" and closing both measure from them
			reset({
				newState: {
					_id: fresh._id,
					profile_image: fresh.profile_image,
					enforcement_group: fresh.enforcement_group._id,
					user_type: fresh.user_type._id,
					firstname: fresh.firstname,
					middlename: fresh.middlename,
					lastname: fresh.lastname,
					username: fresh.username
				}
			});
			photo = null;
			photo_error = null;
		} finally {
			loading = false;
		}
	};

	$effect(() => {
		if (mode === 'edit' && user?._id) {
			const id = user._id;
			untrack(() => loadUser(id));
		}
	});

	//#endregion

	//#region group & user type options

	const current_type = $derived<SelectItems | null>(
		record ? { label: record.user_type.user_type, value: record.user_type._id } : null
	);
	const current_group = $derived<SelectItems | null>(
		record ? { label: record.enforcement_group.name, value: record.enforcement_group._id } : null
	);

	let user_types_select = $state<SelectItems[]>([]);
	let enforcement_select = $state<SelectItems[]>([]);

	// keeps the saved value in the unfiltered list, so the picker can always show it and check it
	const withCurrent = (items: SelectItems[], current: SelectItems | null, search: string) =>
		!current || search || items.some((i) => i.value === current.value)
			? items
			: [current, ...items];

	const searchUserTypes = async (_s: string = '') => {
		const res = await fetch(resolve(`/api/user-types?page=1&size=5&search=${_s}`));
		const json = res.ok ? await res.json() : {};
		const items = json.data?.length ? parseSelectItems(json.data, 'user_type', '_id') : [];
		user_types_select = withCurrent(items, current_type, _s);
	};

	const searchEnforcementGroup = async (_s: string = '') => {
		const res = await fetch(resolve(`/api/enforcement-groups?page=1&size=5&search=${_s}`));
		const json = res.ok ? await res.json() : {};
		const items = json.data?.length ? parseSelectItems(json.data, 'name', '_id') : [];
		enforcement_select = withCurrent(items, current_group, _s);
	};

	// the saved values go in first, synchronously, so both pickers can show their labels straight away
	const seedOptions = () => {
		user_types_select = current_type ? [current_type] : [];
		enforcement_select = current_group ? [current_group] : [];
		searchUserTypes();
		searchEnforcementGroup();
	};

	onMount(() => {
		if (mode === 'create') seedOptions();
	});

	//#endregion

	//#region create: username suggestion

	let username_touched = $state(false);

	const slugify_username = (first: string, last: string): string => {
		const f = first
			.trim()
			.toLowerCase()
			.replace(/[^a-z]/g, '');
		const l = last
			.trim()
			.toLowerCase()
			.replace(/[^a-z]/g, '');
		return f && l ? `${f[0]}.${l}` : '';
	};

	$effect(() => {
		if (mode !== 'create' || username_touched) return;

		const first = $form.firstname;
		const last = $form.lastname;

		const timer = setTimeout(() => {
			const suggested = slugify_username(first, last);
			if (!suggested) return;
			untrack(() => {
				if ($form.username !== suggested) $form.username = suggested;
			});
		}, 500);

		return () => clearTimeout(timer);
	});

	//#endregion

	message.subscribe((m) => {
		if (!m) return;
		if (m.type === 'error') toast.error(m.text);
		if (m.type === 'success') {
			toast.success(m.text);
			// the form itself is reset by superforms; the photo and suggestion state are ours
			photo = null;
			photo_error = null;
			username_touched = false;
		}
	});

	// closing without saving discards the edit, so reopening the same user starts from what's saved
	const onClose = () => {
		photo = null;
		photo_error = null;
		if (mode === 'edit' && record) {
			seedOptions();
			reset();
		}
	};

	const display_name = $derived(
		[$form.firstname, $form.middlename ? `${$form.middlename.charAt(0)}.` : '', $form.lastname]
			.filter(Boolean)
			.join(' ')
	);

	const initial = $derived(($form.firstname ?? '').charAt(0) || undefined);

	const has_changes = $derived(mode === 'edit' && (isTainted($tainted) || !!photo?.length));
</script>

<dialog
	id={dialog_id}
	class="modal p-2 backdrop-blur-xs md:p-4"
	bind:this={dialog}
	onclose={onClose}
	aria-labelledby={`${uid}-title`}
>
	<Toaster position="top-center" richColors />

	<div class="modal-box flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col p-0">
		<header class="flex items-start justify-between gap-4 border-b border-base-300 px-6 py-4">
			<div class="flex min-w-0 flex-col gap-1">
				<h3 id={`${uid}-title`} class="text-base font-semibold tracking-tight">
					{mode === 'create' ? 'Add user' : 'Edit user'}
				</h3>

				{#if mode === 'create'}
					<p class="text-xs text-base-content/70">
						A temporary password is generated for them to change on first sign-in.
					</p>
				{:else if record}
					<div class="flex min-w-0 flex-wrap items-center gap-2 text-xs text-base-content/70">
						{#if record.archived}
							<span class="badge badge-ghost badge-sm">Archived</span>
						{:else}
							<span class="badge badge-soft badge-sm badge-success">Active</span>
						{/if}
						<span class="truncate">{display_name || 'Unnamed user'}</span>
					</div>
				{:else}
					<p class="flex items-center gap-2 text-xs text-base-content/70">
						<span class="loading loading-xs loading-spinner"></span> Loading user
					</p>
				{/if}
			</div>

			<button
				class="btn -mt-1 -mr-2 btn-circle shrink-0 btn-ghost btn-sm"
				type="button"
				onclick={() => dialog.close()}
				aria-label="Close"
			>
				<X class="size-4" />
			</button>
		</header>

		<form
			class="flex min-h-0 grow flex-col"
			method="POST"
			action={mode === 'create' ? '?/create' : '?/edit'}
			use:enhance
			novalidate
			enctype="multipart/form-data"
		>
			{#if mode === 'edit'}
				<input type="hidden" name="_id" value={$form._id ?? ''} />
				<input type="hidden" name="profile_image" value={$form.profile_image ?? ''} />
			{/if}

			<div
				class="grid min-h-0 grow grid-cols-1 gap-x-8 gap-y-4 overflow-y-auto px-6 py-5 md:grid-cols-[17rem_minmax(0,1fr)]"
			>
				<!-- stretches to the height of the fields beside it -->
				<div class="flex w-full flex-col">
					<Dropzone
						name="files"
						layout="fill"
						bind:files={photo}
						bind:error={photo_error}
						current={mode === 'edit' ? $form.profile_image : undefined}
						fallback={initial}
					/>
					{#if $errors.files?.length}
						<InputError>{$errors.files[0]}</InputError>
					{/if}
				</div>

				<div class="flex min-w-0 flex-col gap-5">
					<section class="flex flex-col gap-1" aria-labelledby={`${uid}-personal`}>
						<h4 id={`${uid}-personal`} class="text-sm font-semibold">Personal details</h4>
						<p class="text-xs text-base-content/60">
							Names are saved in capital letters, as they appear on official records.
						</p>

						<div class="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
							<fieldset class="fieldset">
								<legend class="fieldset-legend">First name<span class="text-error">*</span></legend>
								<input
									type="text"
									class="input w-full uppercase"
									class:border-error={$errors.firstname}
									placeholder="Juan"
									name="firstname"
									autocomplete="off"
									disabled={loading}
									bind:value={$form.firstname}
									oninput={(e) => ($form.firstname = e.currentTarget.value.toUpperCase())}
									{...$constraints.firstname}
									aria-invalid={$errors.firstname ? true : undefined}
								/>
								<InputError>{$errors.firstname && $errors?.firstname[0]}</InputError>
							</fieldset>

							<fieldset class="fieldset">
								<legend class="fieldset-legend">Middle name</legend>
								<input
									type="text"
									class="input w-full uppercase"
									class:border-error={$errors.middlename}
									placeholder="Diaz"
									name="middlename"
									autocomplete="off"
									disabled={loading}
									bind:value={$form.middlename}
									oninput={(e) => ($form.middlename = e.currentTarget.value.toUpperCase())}
									{...$constraints.middlename}
									aria-invalid={$errors.middlename ? true : undefined}
								/>
								<InputError>{$errors.middlename && $errors?.middlename[0]}</InputError>
							</fieldset>

							<fieldset class="fieldset">
								<legend class="fieldset-legend">Last name<span class="text-error">*</span></legend>
								<input
									type="text"
									class="input w-full uppercase"
									class:border-error={$errors.lastname}
									placeholder="Dela Cruz"
									name="lastname"
									autocomplete="off"
									disabled={loading}
									bind:value={$form.lastname}
									oninput={(e) => ($form.lastname = e.currentTarget.value.toUpperCase())}
									{...$constraints.lastname}
									aria-invalid={$errors.lastname ? true : undefined}
								/>
								<InputError>{$errors.lastname && $errors?.lastname[0]}</InputError>
							</fieldset>
						</div>
					</section>

					<section
						class="flex flex-col gap-1 border-t border-base-300 pt-5"
						aria-labelledby={`${uid}-access`}
					>
						<h4 id={`${uid}-access`} class="text-sm font-semibold">Account and access</h4>
						<p class="text-xs text-base-content/60">
							The group and user type decide which records this person can see and change.
						</p>

						<div class="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
							<fieldset class="fieldset sm:col-span-2 sm:max-w-[calc(50%-0.375rem)]">
								<legend class="fieldset-legend">Username<span class="text-error">*</span></legend>
								<input
									type="text"
									class="input w-full"
									class:border-error={$errors.username}
									name="username"
									autocomplete="off"
									spellcheck="false"
									disabled={loading}
									{...$constraints.username}
									bind:value={$form.username}
									oninput={() => (username_touched = true)}
									aria-invalid={$errors.username ? true : undefined}
								/>
								{#if $errors.username?.length}
									<InputError>{$errors.username[0]}</InputError>
								{:else if mode === 'edit' && record && $form.username !== record.username}
									<span class="text-xs text-base-content/70">
										They'll sign in with this new username. Let them know.
									</span>
								{:else if mode === 'create' && $form.username}
									<span class="text-xs text-base-content/60">
										{username_touched
											? 'Availability is checked when you add them.'
											: 'Suggested from their name. Availability is checked when you add them.'}
									</span>
								{:else}
									<span class="text-xs text-base-content/60">Used to sign in.</span>
								{/if}
							</fieldset>

							<Combo
								options={enforcement_select}
								placeholder="Search groups..."
								empty_error="No groups match that search."
								label="Enforcement group"
								on_search={(e: string) => searchEnforcementGroup(e)}
								on_select={(selected: SelectItems) =>
									($form.enforcement_group = selected.value as string)}
								name="enforcement_group"
								bind:value={$form.enforcement_group}
								errors={$errors.enforcement_group}
								constraints={$constraints.enforcement_group ?? {}}
								disabled={loading}
								width="full"
							/>

							<Combo
								options={user_types_select}
								placeholder="Search user types..."
								empty_error="No user types match that search."
								label="User type"
								on_search={(e: string) => searchUserTypes(e)}
								on_select={(selected: SelectItems) => ($form.user_type = selected.value as string)}
								name="user_type"
								bind:value={$form.user_type}
								errors={$errors.user_type}
								constraints={$constraints.user_type ?? {}}
								disabled={loading}
								width="full"
							/>
						</div>
					</section>
				</div>
			</div>

			<footer
				class="flex flex-row items-center justify-between gap-3 border-t border-base-300 px-6 py-3"
			>
				<p class="flex items-center gap-2 text-xs text-base-content/70" aria-live="polite">
					{#if has_changes}
						<span class="size-1.5 rounded-full bg-warning" aria-hidden="true"></span>
						Unsaved changes
					{:else}
						<span><span class="text-error">*</span> Required</span>
					{/if}
				</p>

				<div class="flex flex-row gap-2">
					<button
						class="btn btn-ghost btn-sm md:btn-md"
						type="button"
						onclick={() => dialog.close()}>Cancel</button
					>
					<button
						class="btn min-w-32 w-fit btn-sm btn-primary md:btn-md"
						type="submit"
						disabled={$delayed || loading}
					>
						{#if $delayed}
							<span class="loading loading-xs loading-spinner"></span>
							{mode === 'create' ? 'Adding' : 'Saving'}
						{:else}
							{mode === 'create' ? 'Add user' : 'Save changes'}
						{/if}
					</button>
				</div>
			</footer>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop h-dvh">
		<button>close</button>
	</form>
</dialog>
