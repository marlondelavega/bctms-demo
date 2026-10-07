<script lang="ts">
	import { resolve } from '$app/paths';
	import { modules } from '$lib/store/modules.js';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import type UserType from '$lib/validation_schemas/UserTypes.zod.js';
	import { ArrowLeft, IdCard, Search, ShieldCheck, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { superForm, type SuperForm } from 'sveltekit-superforms/client';

	let { data } = $props();

	const {
		form,
		errors,
		enhance,
		message,
		delayed,
		constraints
	}: SuperForm<UserType.Create, App.Superforms.Message> = superForm(data.createForm, {
		delayMs: 500,
		timeoutMs: 8000,
		dataType: 'json'
	});

	message.subscribe((m) => {
		if (m) {
			if (m.type == 'error') {
				toast.error(m.text);
			} else if (m.type == 'success') {
				toast.success(m.text);
			}
		}
	});

	// action columns, in the same order used to lay out the flat permissions array
	const ACTIONS = [
		{ key: 'access', label: 'Access' },
		{ key: 'create', label: 'Create' },
		{ key: 'edit', label: 'Edit' },
		{ key: 'archive', label: 'Archive' },
		{ key: 'restore', label: 'Restore' }
	] as const;

	const LEVELS = [
		{ value: 'all', label: 'All' },
		{ value: 'office', label: 'Office' },
		{ value: 'own', label: 'Own' },
		{ value: 'none', label: 'No' }
	] as const;

	// every module/action combo needs a starting value, otherwise the bound
	// <select> falls back to its first <option> even though nothing was submitted
	modules.forEach((m, i) => {
		ACTIONS.forEach((a, ai) => {
			const idx = i * 5 + ai;
			if (!$form.permissions[idx]) {
				$form.permissions[idx] = `${a.key}:none:${m.collection}`;
			}
		});
	});

	const levelOf = (value?: string) => value?.split(':')[1] ?? 'none';

	const levelSelectClass = (value?: string) => {
		switch (levelOf(value)) {
			case 'all':
				return 'select-success';
			case 'office':
				return 'select-warning';
			case 'own':
				return 'select-info';
			default:
				return '';
		}
	};

	const setRow = (index: number, collection: string, level: string) => {
		ACTIONS.forEach((a, ai) => {
			$form.permissions[index * 5 + ai] = `${a.key}:${level}:${collection}`;
		});
	};

	const setColumn = (actionIndex: number, level: string) => {
		modules.forEach((m, i) => {
			$form.permissions[i * 5 + actionIndex] =
				`${ACTIONS[actionIndex].key}:${level}:${m.collection}`;
		});
	};

	const setAll = (level: string) => {
		modules.forEach((m, i) => setRow(i, m.collection, level));
	};

	let search = $state('');

	let filteredModules = $derived(
		modules
			.map((m, i) => ({ ...m, i }))
			.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()))
	);

	let grantedCount = $derived(
		modules.filter((_, i) =>
			ACTIONS.some((_a, ai) => levelOf($form.permissions[i * 5 + ai]) !== 'none')
		).length
	);
</script>

<Header title="Add User Type"></Header>

<div class="box-border flex min-h-0 w-full max-w-full grow flex-col gap-6 p-4 lg:max-w-5xl">
	<form
		class=" flex min-h-0 w-full grow flex-col gap-4 overflow-auto"
		method="POST"
		action="?/create"
		use:enhance
		novalidate
		id="form"
	>
		<a
			class="flex w-fit flex-row items-center gap-2 text-xs"
			href={resolve('/u/user-types?page=1&size=10')}
		>
			<ArrowLeft class="size-3" /> Back
		</a>

		<div class="flex flex-col gap-3 rounded-box border border-base-300 p-4">
			<div class="flex items-center gap-2">
				<IdCard class="size-3.5 text-base-content/60" />
				<h1 class="text-xs font-bold">User type details</h1>
			</div>

			<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
				<fieldset class="fieldset md:col-span-1">
					<legend class="fieldset-legend">User type<span class="text-error">*</span></legend>
					<input
						name="user_type"
						type="text"
						class="input w-full"
						class:border-error={$errors.user_type}
						placeholder="Billing"
						bind:value={$form.user_type}
						{...$constraints.user_type}
						aria-invalid={$errors.user_type ? true : undefined}
					/>
					<InputError>{$errors.user_type && $errors?.user_type[0]}</InputError>
				</fieldset>

				<fieldset class="fieldset md:col-span-2">
					<legend class="fieldset-legend">Role<span class="text-error">*</span></legend>
					<textarea
						name="role"
						class="textarea h-full max-h-28 w-full md:max-h-none"
						class:border-error={$errors.role}
						placeholder="Personnel for billing..."
						bind:value={$form.role}
						{...$constraints.role}
						aria-invalid={$errors.role ? true : undefined}
					>
					</textarea>
					<InputError>{$errors.role && $errors?.role[0]}</InputError>
				</fieldset>
			</div>
		</div>

		<div class="flex min-w-0 grow flex-col gap-3 rounded-box border border-base-300 p-4">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<ShieldCheck class="size-3.5 text-base-content/60" />
					<h1 class="text-xs font-bold">User permissions</h1>
					<span class="badge badge-sm badge-ghost">{grantedCount}/{modules.length} modules</span>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<label class="input input-sm flex w-44 items-center gap-2">
						<Search class="size-3.5 opacity-50" />
						<input type="text" class="grow" placeholder="Filter modules..." bind:value={search} />
						{#if search}
							<button
								type="button"
								class="btn btn-ghost btn-circle btn-xs"
								aria-label="Clear filter"
								onclick={() => (search = '')}
							>
								<X class="size-3" />
							</button>
						{/if}
					</label>

					<select
						class="select select-sm w-auto"
						onchange={(e) => {
							const v = e.currentTarget.value;
							if (v) setAll(v);
							e.currentTarget.value = '';
						}}
					>
						<option value="">Set all to...</option>
						{#each LEVELS as l (l.value)}
							<option value={l.value}>{l.label}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-base-content/60">
				<span class="flex items-center gap-1">
					<span class="badge badge-success badge-xs"></span> All — full, system-wide access
				</span>
				<span class="flex items-center gap-1">
					<span class="badge badge-warning badge-xs"></span> Office — limited to own office
				</span>
				<span class="flex items-center gap-1">
					<span class="badge badge-info badge-xs"></span> Own — limited to own records
				</span>
				<span class="flex items-center gap-1">
					<span class="badge badge-ghost badge-xs"></span> No — access denied
				</span>
			</div>

			<div class="h-96 overflow-auto rounded-box border border-base-300">
				<table
					class="table-pin-cols table-pin-rows table border-separate border-spacing-0 table-xs"
				>
					<thead class="z-22 text-xs">
						<tr>
							<th class="bg-base-200">System module</th>
							<th class="min-w-28 bg-base-200 text-center">Quick set</th>
							{#each ACTIONS as a (a.key)}
								<th class="bg-base-200 text-center">{a.label}</th>
							{/each}
						</tr>
						<tr class="text-[11px] text-base-content/60">
							<th class="bg-base-100 font-normal">Set entire column</th>
							<th class="bg-base-100"></th>
							{#each ACTIONS as a, ai (a.key)}
								<th class="bg-base-100 p-1">
									<select
										class="select select-xs w-full"
										onchange={(e) => {
											const v = e.currentTarget.value;
											if (v) setColumn(ai, v);
											e.currentTarget.value = '';
										}}
									>
										<option value="">Set column</option>
										{#each LEVELS as l (l.value)}
											<option value={l.value}>{l.label}</option>
										{/each}
									</select>
								</th>
							{/each}
						</tr>
					</thead>

					<tbody class=" text-xs">
						{#each filteredModules as m (m.collection)}
							<tr class="hover:bg-base-200/50">
								<th class="font-medium">{m.name}</th>
								<td class="text-center">
									<select
										class="select select-xs w-full"
										onchange={(e) => {
											const v = e.currentTarget.value;
											if (v) setRow(m.i, m.collection, v);
											e.currentTarget.value = '';
										}}
									>
										<option value="">Quick set</option>
										{#each LEVELS as l (l.value)}
											<option value={l.value}>{l.label}</option>
										{/each}
									</select>
								</td>
								{#each ACTIONS as a, ai (a.key)}
									<td class="text-center">
										<select
											class="select select-xs {levelSelectClass($form.permissions[m.i * 5 + ai])}"
											name="permissions"
											bind:value={$form.permissions[m.i * 5 + ai]}
										>
											<option value={`${a.key}:all:${m.collection}`}>All</option>
											<option value={`${a.key}:own:${m.collection}`}>Own</option>
											<option value={`${a.key}:office:${m.collection}`}>Office</option>
											<option value={`${a.key}:none:${m.collection}`}>No</option>
										</select>
									</td>
								{/each}
							</tr>
						{:else}
							<tr>
								<td colspan={2 + ACTIONS.length} class="py-6 text-center text-xs opacity-60">
									No modules match "{search}".
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</form>

	<div class="modal-action mt-0 flex w-full flex-row justify-end">
		<button class="btn btn-ghost btn-sm md:btn-md" type="reset">Clear</button>
		<button class="btn btn-sm btn-primary md:btn-md" type="submit" form="form">
			{#if $delayed}
				<span class="loading loading-xs loading-spinner"></span>
			{:else}
				Submit
			{/if}
		</button>
	</div>
</div>
