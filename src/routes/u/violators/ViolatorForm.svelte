<script lang="ts">
	import { resolve } from '$app/paths';
	import { city_barangays } from '$lib/data/static_data';
	import { lgu } from '$lib/data/lgu';
	import { suffix_select } from '$lib/data/suffix_data';
	import Dropzone from '$lib/ui/components/dropzone/Dropzone.svelte';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import { calculateAge, date, escapeRegex } from '$lib/utilities/helper';
	import type Violator from '$lib/validation_schemas/Violators.zod';
	import { ArrowLeft, ExternalLink, TriangleAlert } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		dateProxy,
		numberProxy,
		stringProxy,
		superForm,
		type SuperValidated
	} from 'sveltekit-superforms';

	let {
		mode,
		data,
		archived = false
	}: {
		mode: 'create' | 'edit';
		/** the create or edit form from the page's load */
		data:
			| SuperValidated<Violator.Create, App.Superforms.Message>
			| SuperValidated<Violator.Edit, App.Superforms.Message>;
		archived?: boolean;
	} = $props();

	const uid = $props.id();

	const { form, errors, enhance, constraints, message, delayed, tainted, isTainted, reset } =
		// both schemas share every field rendered here (edit only adds `_id`), so one typed view serves both
		superForm(data as SuperValidated<Violator.Edit, App.Superforms.Message>, {
			delayMs: 400,
			timeoutMs: 8000,
			taintedMessage: 'Leave this page? Your unsaved changes will be lost.'
		});

	const sex_proxy = stringProxy(form, 'sex', { empty: 'undefined' });
	const house_number_proxy = numberProxy(form, 'address_house_number', {
		initiallyEmptyIfZero: true
	});
	const birthdate_proxy = dateProxy(form, 'birthdate', { format: 'date' });

	let photo = $state<FileList | null>(null);
	let photo_error = $state<string | null>(null);

	const today = date.dateToString();

	const age = $derived.by(() => {
		const value = $birthdate_proxy;
		if (!value || value > today || value < '1900-01-01') return null;
		try {
			return calculateAge(value);
		} catch {
			return null;
		}
	});

	//#region contact number: the +63 is fixed, only the 10 digits after it are typed

	const contact_local = $derived(String($form.contact_number ?? '').replace(/^\+63/, ''));

	const setContact = (input: HTMLInputElement) => {
		const digits = input.value.replace(/\D/g, '').slice(0, 10);
		input.value = digits;
		$form.contact_number = digits ? `+63${digits}` : '';
	};

	//#endregion

	//#region address suggestions (psgc.cloud); fields stay free text if it can't be reached

	type Place = { name: string; code: string };

	let provinces = $state<Place[]>([]);
	let cities = $state<Place[]>([]);
	let fetched_barangays = $state<string[]>([]);

	const fetchPlaces = async (path: string): Promise<Place[]> => {
		try {
			const res = await fetch(`https://psgc.cloud/api/v2/${path}`);
			return res.ok ? ((await res.json()).data ?? []) : [];
		} catch {
			return [];
		}
	};

	const same = (a: string | undefined, b: string | undefined) =>
		(a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

	// derived codes only change when the typed name lands on a different place, so typing elsewhere fetches nothing
	const province_code = $derived(provinces.find((p) => same(p.name, $form.address_province))?.code);
	const city_code = $derived(cities.find((c) => same(c.name, $form.address_city))?.code);
	const in_city = $derived(lgu.city_pattern.test($form.address_city ?? ''));

	const barangay_options = $derived(in_city ? city_barangays : fetched_barangays);

	onMount(async () => {
		provinces = await fetchPlaces('provinces');
	});

	$effect(() => {
		const code = province_code;
		let stale = false;
		if (!code) cities = [];
		else fetchPlaces(`provinces/${code}/cities-municipalities`).then((d) => !stale && (cities = d));
		return () => (stale = true);
	});

	$effect(() => {
		const code = city_code;
		let stale = false;
		if (!code || in_city) fetched_barangays = [];
		else
			fetchPlaces(`cities-municipalities/${code}/barangays`).then(
				(d) => !stale && (fetched_barangays = d.map((b) => b.name))
			);
		return () => (stale = true);
	});

	// picking a different province or city empties the fields below it, which belonged to the old one
	let value_on_focus = '';
	const rememberValue = (e: FocusEvent) =>
		(value_on_focus = (e.currentTarget as HTMLInputElement).value);

	const onProvinceChange = (e: Event) => {
		if (same((e.currentTarget as HTMLInputElement).value, value_on_focus)) return;
		$form.address_city = '';
		$form.address_barangay = '';
	};

	const onCityChange = (e: Event) => {
		if (same((e.currentTarget as HTMLInputElement).value, value_on_focus)) return;
		$form.address_barangay = '';
	};

	//#endregion

	//#region create: records that may be the same person

	let matches = $state<Violator.Base[]>([]);

	const match_key = $derived(
		mode === 'create'
			? `${($form.lastname ?? '').trim().toUpperCase()}|${($form.firstname ?? '').trim().toUpperCase()}`
			: ''
	);

	$effect(() => {
		const [last = '', first = ''] = match_key.split('|');
		if (last.length < 2 || first.length < 2) {
			matches = [];
			return;
		}

		const timer = setTimeout(async () => {
			try {
				const res = await fetch(
					`${resolve('/api/violators')}?page=1&size=20&search=${encodeURIComponent(escapeRegex(last))}`
				);
				const list: Violator.Base[] = res.ok ? ((await res.json()).data ?? []) : [];
				matches = list
					.filter(
						(v) =>
							v.lastname?.toUpperCase() === last &&
							(v.firstname?.toUpperCase().startsWith(first) ||
								first.startsWith(v.firstname?.toUpperCase() ?? '-'))
					)
					.slice(0, 5);
			} catch {
				matches = [];
			}
		}, 400);

		return () => clearTimeout(timer);
	});

	const matchName = (v: Violator.Base) =>
		[v.firstname, v.middlename, v.lastname, v.suffix?.toUpperCase()].filter(Boolean).join(' ');

	const sameBirthdate = (v: Violator.Base) =>
		!!$birthdate_proxy && String(v.birthdate ?? '').slice(0, 10) === $birthdate_proxy;

	//#endregion

	message.subscribe((m) => {
		if (!m) return;
		if (m.type === 'error') toast.error(m.text);
		if (m.type === 'success') {
			toast.success(m.text);
			// superforms resets the fields; the photo and match list are ours
			photo = null;
			photo_error = null;
			matches = [];
		}
	});

	const clearForm = () => {
		reset();
		photo = null;
		photo_error = null;
	};

	const display_name = $derived(
		[$form.firstname, $form.middlename ? `${$form.middlename.charAt(0)}.` : '', $form.lastname]
			.filter(Boolean)
			.join(' ')
	);

	const has_changes = $derived(isTainted($tainted) || !!photo?.length);

	const input_class = (error: unknown) => ['input w-full', error ? 'border-error' : ''];
</script>

<form
	class="flex min-h-0 w-full grow flex-col overflow-hidden rounded-box border border-base-300 bg-base-100"
	method="POST"
	action={mode === 'create' ? '?/create' : '?/edit'}
	use:enhance
	novalidate
	enctype="multipart/form-data"
>
	<header
		class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-base-300 px-4 py-3 md:px-6"
	>
		<a
			class="btn -ml-2 gap-1.5 px-2 btn-ghost btn-sm"
			href={resolve('/u/violators?page=1&size=10')}
		>
			<ArrowLeft class="size-4" /> Violators
		</a>

		{#if mode === 'edit'}
			<div class="flex min-w-0 items-center gap-2 text-xs text-base-content/70">
				{#if archived}
					<span class="badge badge-ghost badge-sm">Archived</span>
				{/if}
				<span class="truncate">{display_name || 'Unnamed violator'}</span>
			</div>
		{:else}
			<p class="text-xs text-base-content/70">
				Violators already on record with the same name show up as you type.
			</p>
		{/if}
	</header>

	{#if mode === 'edit'}
		<input type="hidden" name="_id" value={$form._id ?? ''} />
		<input type="hidden" name="profile_image" value={$form.profile_image ?? ''} />
	{/if}
	<input type="hidden" name="contact_number" value={$form.contact_number ?? ''} />

	<div
		class="grid min-h-0 grow grid-cols-1 content-start gap-x-8 gap-y-5 overflow-y-auto px-4 py-5 md:grid-cols-[15rem_minmax(0,1fr)] md:px-6"
	>
		<!-- photo: a portrait slot that stays in view while the fields scroll -->
		<!-- phones: height follows the content (a shorter drop area); md+: a fixed portrait slot -->
		<div
			class="flex w-full min-w-0 flex-col max-md:[&_label]:min-h-48 md:sticky md:top-0 md:h-88 md:self-start"
		>
			<Dropzone
				name="files"
				layout="fill"
				bind:files={photo}
				bind:error={photo_error}
				current={mode === 'edit' ? $form.profile_image : undefined}
				fallback={($form.firstname ?? '').charAt(0) || undefined}
			/>
			{#if $errors.files?.length}
				<InputError>{$errors.files[0]}</InputError>
			{/if}
		</div>

		<div class="flex min-w-0 flex-col gap-6">
			<!-- personal -->
			<section class="flex flex-col gap-1" aria-labelledby={`${uid}-personal`}>
				<h2 id={`${uid}-personal`} class="text-sm font-semibold">Personal details</h2>
				<p class="text-xs text-base-content/60">
					Copy the name and birthdate from the driver's license or another ID. Names are saved in
					capital letters.
				</p>

				<div class="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">First name<span class="text-error">*</span></legend>
						<input
							type="text"
							class={[input_class($errors.firstname), 'uppercase']}
							placeholder="Juan"
							name="firstname"
							autocomplete="off"
							bind:value={$form.firstname}
							oninput={(e) => ($form.firstname = e.currentTarget.value.toUpperCase())}
							{...$constraints.firstname}
							aria-invalid={$errors.firstname ? true : undefined}
							aria-describedby={`${uid}-firstname-error`}
						/>
						<InputError id={`${uid}-firstname-error`}
							>{$errors.firstname && $errors.firstname[0]}</InputError
						>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Middle name</legend>
						<input
							type="text"
							class={[input_class($errors.middlename), 'uppercase']}
							placeholder="Diaz"
							name="middlename"
							autocomplete="off"
							bind:value={$form.middlename}
							oninput={(e) => ($form.middlename = e.currentTarget.value.toUpperCase())}
							{...$constraints.middlename}
							aria-invalid={$errors.middlename ? true : undefined}
							aria-describedby={`${uid}-middlename-error`}
						/>
						<InputError id={`${uid}-middlename-error`}
							>{$errors.middlename && $errors.middlename[0]}</InputError
						>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Last name<span class="text-error">*</span></legend>
						<input
							type="text"
							class={[input_class($errors.lastname), 'uppercase']}
							placeholder="Dela Cruz"
							name="lastname"
							autocomplete="off"
							bind:value={$form.lastname}
							oninput={(e) => ($form.lastname = e.currentTarget.value.toUpperCase())}
							{...$constraints.lastname}
							aria-invalid={$errors.lastname ? true : undefined}
							aria-describedby={`${uid}-lastname-error`}
						/>
						<InputError id={`${uid}-lastname-error`}
							>{$errors.lastname && $errors.lastname[0]}</InputError
						>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Suffix</legend>
						<select
							name="suffix"
							class={['select w-full', $errors.suffix && 'border-error']}
							bind:value={$form.suffix}
							{...$constraints.suffix}
							aria-invalid={$errors.suffix ? true : undefined}
						>
							<option value="">None</option>
							{#each suffix_select as _s (_s.value)}
								<option value={_s.value}>{_s.label}</option>
							{/each}
						</select>
						<InputError>{$errors.suffix && $errors.suffix[0]}</InputError>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Sex<span class="text-error">*</span></legend>
						<select
							name="sex"
							class={['select w-full', $errors.sex && 'border-error']}
							bind:value={$sex_proxy}
							{...$constraints.sex}
							aria-invalid={$errors.sex ? true : undefined}
							aria-describedby={`${uid}-sex-error`}
						>
							<option value="" disabled>Select</option>
							<option value="male">Male</option>
							<option value="female">Female</option>
						</select>
						<InputError id={`${uid}-sex-error`}>{$errors.sex && $errors.sex[0]}</InputError>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Birthdate<span class="text-error">*</span></legend>
						<input
							type="date"
							class={input_class($errors.birthdate)}
							name="birthdate"
							min="1900-01-01"
							max={today}
							bind:value={$birthdate_proxy}
							{...$constraints.birthdate}
							aria-invalid={$errors.birthdate ? true : undefined}
							aria-describedby={`${uid}-birthdate-hint`}
						/>
						{#if $errors.birthdate?.length}
							<InputError id={`${uid}-birthdate-hint`}>{$errors.birthdate[0]}</InputError>
						{:else}
							<p id={`${uid}-birthdate-hint`} class="h-4 text-xs text-base-content/60">
								{#if age !== null}{age} {age === 1 ? 'year' : 'years'} old{/if}
							</p>
						{/if}
					</fieldset>
				</div>

				{#if matches.length}
					<div
						class="mt-1 flex flex-col gap-2 rounded-field bg-warning/10 p-3"
						role="status"
						aria-live="polite"
					>
						<p class="flex items-start gap-2 text-sm">
							<TriangleAlert class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
							<span>
								{matches.length === 1
									? 'A violator with this name is already on record.'
									: `${matches.length} violators with this name are already on record.`}
								If it's the same person, use their record when issuing instead of adding them again.
							</span>
						</p>
						<ul class="flex flex-col gap-1 pl-6">
							{#each matches as v (v._id)}
								<li class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
									<a
										class="link font-medium link-hover"
										href={resolve('/u/violators/[id]/edit', { id: v._id })}
										target="_blank"
										rel="noopener"
									>
										{matchName(v)}
										<ExternalLink
											class="inline size-3 align-baseline"
											aria-label="opens in a new tab"
										/>
									</a>
									<span class="text-xs text-base-content/70 tabular-nums">
										born {v.birthdate
											? new Date(v.birthdate).toLocaleDateString('en-PH', { dateStyle: 'medium' })
											: 'unknown'}
										{#if v.address_barangay}· {v.address_barangay}{/if}
									</span>
									{#if sameBirthdate(v)}
										<span class="badge badge-soft badge-xs badge-warning">Same birthdate</span>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</section>

			<!-- contact & license -->
			<section
				class="flex flex-col gap-1 border-t border-base-300 pt-5"
				aria-labelledby={`${uid}-contact`}
			>
				<h2 id={`${uid}-contact`} class="text-sm font-semibold">Contact and license</h2>
				<p class="text-xs text-base-content/60">Both are optional. Leave them blank if unknown.</p>

				<div class="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Mobile number</legend>
						<label
							class={[input_class($errors.contact_number), 'gap-0 pl-0']}
							for={`${uid}-contact-input`}
						>
							<span
								class="flex h-full items-center border-r border-base-300 px-3 text-base-content/70 tabular-nums"
								aria-hidden="true">+63</span
							>
							<input
								id={`${uid}-contact-input`}
								type="tel"
								inputmode="numeric"
								autocomplete="off"
								class="grow pl-3 tabular-nums"
								placeholder="912 345 6789"
								value={contact_local}
								oninput={(e) => setContact(e.currentTarget)}
								aria-label="Mobile number, the 10 digits after +63"
								aria-invalid={$errors.contact_number ? true : undefined}
								aria-describedby={`${uid}-contact-error`}
							/>
						</label>
						<InputError id={`${uid}-contact-error`}
							>{$errors.contact_number && $errors.contact_number[0]}</InputError
						>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Driver's license number</legend>
						<input
							type="text"
							class={[input_class($errors.license_number), 'uppercase tabular-nums']}
							placeholder="A00-88-123456"
							name="license_number"
							autocomplete="off"
							spellcheck="false"
							bind:value={$form.license_number}
							oninput={(e) => ($form.license_number = e.currentTarget.value.toUpperCase())}
							{...$constraints.license_number}
							aria-invalid={$errors.license_number ? true : undefined}
						/>
						<InputError>{$errors.license_number && $errors.license_number[0]}</InputError>
					</fieldset>
				</div>
			</section>

			<!-- address -->
			<section
				class="flex flex-col gap-1 border-t border-base-300 pt-5"
				aria-labelledby={`${uid}-address`}
			>
				<h2 id={`${uid}-address`} class="text-sm font-semibold">Home address</h2>
				<p class="text-xs text-base-content/60">
					Where the violator lives, which can differ from where they were apprehended.
				</p>

				<div class="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Province<span class="text-error">*</span></legend>
						<input
							list={`${uid}-provinces`}
							type="text"
							class={input_class($errors.address_province)}
							placeholder={lgu.province}
							name="address_province"
							autocomplete="off"
							bind:value={$form.address_province}
							onfocus={rememberValue}
							onchange={onProvinceChange}
							{...$constraints.address_province}
							aria-invalid={$errors.address_province ? true : undefined}
						/>
						<InputError>{$errors.address_province && $errors.address_province[0]}</InputError>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend"
							>City or municipality<span class="text-error">*</span></legend
						>
						<input
							list={`${uid}-cities`}
							type="text"
							class={input_class($errors.address_city)}
							placeholder={lgu.city}
							name="address_city"
							autocomplete="off"
							bind:value={$form.address_city}
							onfocus={rememberValue}
							onchange={onCityChange}
							{...$constraints.address_city}
							aria-invalid={$errors.address_city ? true : undefined}
						/>
						<InputError>{$errors.address_city && $errors.address_city[0]}</InputError>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Barangay<span class="text-error">*</span></legend>
						<input
							list={`${uid}-barangays`}
							type="text"
							class={input_class($errors.address_barangay)}
							placeholder={in_city ? 'Poblacion' : 'Barangay'}
							name="address_barangay"
							autocomplete="off"
							bind:value={$form.address_barangay}
							{...$constraints.address_barangay}
							aria-invalid={$errors.address_barangay ? true : undefined}
						/>
						<InputError>{$errors.address_barangay && $errors.address_barangay[0]}</InputError>
					</fieldset>
				</div>

				<div class="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">House no.</legend>
						<input
							type="number"
							inputmode="numeric"
							min="0"
							class={[input_class($errors.address_house_number), 'tabular-nums']}
							placeholder="12"
							name="address_house_number"
							bind:value={$house_number_proxy}
							{...$constraints.address_house_number}
							aria-invalid={$errors.address_house_number ? true : undefined}
						/>
						<InputError
							>{$errors.address_house_number && $errors.address_house_number[0]}</InputError
						>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Street, purok or sitio</legend>
						<input
							type="text"
							class={input_class($errors.address_line)}
							placeholder="Purok 3, Montero Street"
							name="address_line"
							autocomplete="off"
							bind:value={$form.address_line}
							{...$constraints.address_line}
							aria-invalid={$errors.address_line ? true : undefined}
						/>
						<InputError>{$errors.address_line && $errors.address_line[0]}</InputError>
					</fieldset>
				</div>
			</section>
		</div>
	</div>

	<footer
		class="flex flex-row items-center justify-between gap-3 border-t border-base-300 px-4 py-3 md:px-6"
	>
		<p class="flex items-center gap-2 text-xs text-base-content/70" aria-live="polite">
			{#if has_changes && mode === 'edit'}
				<span class="size-1.5 rounded-full bg-warning" aria-hidden="true"></span>
				Unsaved changes
			{:else}
				<span><span class="text-error">*</span> Required</span>
			{/if}
		</p>

		<div class="flex flex-row gap-2">
			{#if mode === 'create'}
				<button
					class="btn btn-ghost btn-sm md:btn-md"
					type="button"
					onclick={clearForm}
					disabled={!has_changes || $delayed}>Clear</button
				>
			{:else}
				<a class="btn btn-ghost btn-sm md:btn-md" href={resolve('/u/violators?page=1&size=10')}
					>Cancel</a
				>
			{/if}
			<button
				class="btn w-fit min-w-32 btn-sm btn-primary md:btn-md"
				type="submit"
				disabled={$delayed}
			>
				{#if $delayed}
					<span class="loading loading-xs loading-spinner"></span>
					{mode === 'create' ? 'Adding' : 'Saving'}
				{:else}
					{mode === 'create' ? 'Add violator' : 'Save changes'}
				{/if}
			</button>
		</div>
	</footer>
</form>

<datalist id={`${uid}-provinces`}>
	{#each provinces as p (p.code)}
		<option value={p.name}></option>
	{/each}
</datalist>

<datalist id={`${uid}-cities`}>
	{#each cities as c (c.code)}
		<option value={c.name}></option>
	{/each}
</datalist>

<datalist id={`${uid}-barangays`}>
	{#each barangay_options as b (b)}
		<option value={b}></option>
	{/each}
</datalist>
