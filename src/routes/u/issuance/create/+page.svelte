<script lang="ts">
	import { city_barangays, issuance_form_step } from '$lib/data/static_data.js';
	import type { SelectItems } from '$lib/types/T_select_options';
	import Combo from '$lib/ui/components/input/Combo.svelte';
	import Combobox from '$lib/ui/components/input/Combobox.svelte';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import Header from '$lib/ui/layout/header/Header.svelte';
	import {
		date,
		formatAddress,
		getNumberOrdinal,
		getPreviewUrl,
		parseName,
		parseSelectItemsV2
	} from '$lib/utilities/helper';
	import type CodeProvision from '$lib/validation_schemas/CodeProvisions.zod.js';
	import Issuance from '$lib/validation_schemas/Issuances.zod';
	import Violator from '$lib/validation_schemas/Violators.zod.js';
	import {
		Check,
		CircleCheck,
		Clock,
		ExternalLink,
		Pencil,
		RefreshCw,
		TriangleAlert,
		X
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount, tick, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
	import {
		dateProxy,
		superForm,
		superValidate,
		type FormPathLeaves,
		type SuperForm
	} from 'sveltekit-superforms/client';

	const { data } = $props();

	type Penalty = { pecuniary: number; disciplinary: string };
	type ViolationRow = {
		id: string;
		detail: CodeProvision.Base | undefined;
		detail_failed: boolean;
		level: number | undefined;
		level_failed: boolean;
		penalty: Penalty | undefined;
	};
	type Receipt = {
		_id: string;
		tracking_code: string;
		violator_name: string;
		ticket_assignment: string;
		ticket_label: string;
		issuer: string;
		series: number;
		apprehended_on: string;
		apprehended_at: string;
		violation_count: number;
		total: number;
		total_final: boolean;
	};

	// which fields live on which step, so a rejected submit can jump to the first problem
	const step_fields: (keyof Issuance.Create)[][] = [
		['recipient'],
		['ticket_assignment', 'ticket_series', 'remarks'],
		['violations'],
		['apprehension_date', 'apprehension_time', 'apprehension_barangay', 'apprehension_address']
	];

	const step_hints = [
		'Search by name, then check the photo and birthdate before continuing.',
		"Pick the pad and the series number you're writing on.",
		"Add every violation written on the ticket. Fines follow this violator's offense history.",
		'When and where the violation happened.',
		'Check everything against the paper ticket before issuing.'
	];

	let tickets_select: SelectItems[] = $state([]);
	let violators_select: SelectItems[] = $state([]);
	let provisions_select: SelectItems[] = $state([]);
	let series_select: number[] = $state([]);
	let form_step = $state<0 | 1 | 2 | 3 | 4>(0);
	let step_error = $state('');

	let loading_violator = $state(false);
	let violator_error = $state('');
	let invalid_violator_details = $state(false);
	let invalid_violator_errors: string[] = $state([]);
	let violator_details: Violator.Base | undefined = $state();
	let photo_failed = $state(false);

	let selected_ticket_label = $state('');
	let receipt = $state<Receipt | null>(null);
	let pending_receipt: Omit<Receipt, '_id' | 'tracking_code'> | null = null;

	let dialog: HTMLDialogElement;

	const super_form: SuperForm<Issuance.Create, App.Superforms.Message> = superForm(data.form, {
		dataType: 'json',
		validators: zod4Client(Issuance.CreateSchema),
		taintedMessage: "This ticket hasn't been issued yet. Leave and discard what you've entered?",
		onSubmit: () => {
			pending_receipt = buildReceipt();
		},
		onUpdated: ({ form: updated }) => {
			const m = updated.message;
			if (updated.valid && m?.type === 'success' && pending_receipt) {
				const issued = m.data as { _id: string; tracking_code: string };
				receipt = { ...pending_receipt, ...issued };
				pending_receipt = null;
				focusHeading('receipt-heading');
			} else if (!updated.valid) {
				jumpToFirstError(updated.errors);
			}
		}
	});

	const {
		form,
		errors,
		enhance,
		message,
		constraints,
		validate,
		validateForm,
		submitting,
		isTainted
	} = super_form;

	const apprehension_date_proxy = dateProxy(form, 'apprehension_date', { format: 'date-local' });
	const apprehension_time_proxy = dateProxy(form, 'apprehension_time', { format: 'time-local' });

	const peso = (n: number) =>
		`₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

	const toDateInput = (d: Date) =>
		`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

	const today = toDateInput(new Date());

	const getValidationErrors = (value: unknown): string[] => {
		if (typeof value === 'string') return [value];
		if (Array.isArray(value)) return value.flatMap(getValidationErrors);
		if (value && typeof value === 'object') {
			return Object.values(value).flatMap(getValidationErrors);
		}
		return [];
	};

	// ---------- navigation between steps ----------

	const focusHeading = async (id: string) => {
		await tick();
		document.getElementById(id)?.focus();
	};

	const goToStep = (step: number) => {
		form_step = step as typeof form_step;
		step_error = '';
		focusHeading(`step-${step}-heading`);
	};

	const jumpToFirstError = (form_errors: Record<string, unknown>) => {
		const first = step_fields.findIndex((fields) =>
			fields.some((field) => getValidationErrors(form_errors[field]).length > 0)
		);
		if (first >= 0) {
			goToStep(first);
			step_error = getValidationErrors(form_errors[step_fields[first][0]])[0] ?? '';
		}
	};

	const validateFields = async (fields: FormPathLeaves<Issuance.Create>[]) => {
		let ok = true;
		for (const field of fields) {
			const field_errors = await validate(field, { update: 'errors', taint: true });
			if (field_errors) ok = false;
		}
		return ok;
	};

	const validateStep = async (): Promise<boolean> => {
		step_error = '';

		if (form_step == 0) {
			if (!(await validateFields(['recipient']))) return false;
			if (loading_violator) {
				step_error = "Still loading this violator's profile. Try again in a moment.";
				return false;
			}
			if (invalid_violator_details) {
				step_error = "Fix this violator's profile before issuing a ticket.";
				return false;
			}
			if (!violator_details) {
				step_error = "This violator's profile didn't load. Retry before continuing.";
				return false;
			}
		} else if (form_step == 1) {
			return validateFields(['ticket_assignment', 'ticket_series', 'remarks']);
		} else if (form_step == 2) {
			if (!$form.violations.length) {
				step_error = 'Add at least one violation.';
				return false;
			}
			const result = await validateForm({ update: false });
			const violation_errors = getValidationErrors(result.errors.violations);
			if (violation_errors.length) {
				step_error = violation_errors[0];
				return false;
			}
		} else if (form_step == 3) {
			if (
				!(await validateFields([
					'apprehension_date',
					'apprehension_time',
					'apprehension_barangay',
					'apprehension_address'
				]))
			)
				return false;
			if ($apprehension_date_proxy && $apprehension_date_proxy > today) {
				$errors.apprehension_date = ["The apprehension date can't be in the future."];
				return false;
			}
		}

		return true;
	};

	const next = async () => {
		if (await validateStep()) goToStep(form_step + 1);
	};

	const issue = async () => {
		if ($submitting) return;
		const result = await validateForm({ update: true });
		if (!result.valid) {
			jumpToFirstError(result.errors);
			return;
		}
		super_form.submit();
	};

	const discard = () => {
		if (isTainted()) {
			dialog.showModal();
		} else {
			goto(resolve('/u/issuance'));
		}
	};

	// ---------- lookups ----------

	const violatorOption = (v: Violator.Base): SelectItems => ({
		label: parseName(v),
		value: v._id,
		detail: [
			v.birthdate ? `Born ${date.formatDate({ date: v.birthdate, format: 'MMM dd, yyyy' })}` : '',
			v.license_number ? `Lic. ${v.license_number}` : '',
			v.address_barangay ?? ''
		]
			.filter(Boolean)
			.join(' · ')
	});

	const searchTickets = async (_s: string = '', user: string = '') => {
		try {
			const _rq = await fetch(
				resolve(`/api/ticket-assignments/user?page=1&size=5&search=${_s}&user=${user}`)
			);
			const _rs = await _rq.json();
			tickets_select = _rs.data?.length
				? parseSelectItemsV2(_rs.data, '$ticket.name ($series_from-$series_to)', '_id')
				: [];
		} catch {
			tickets_select = [];
		}
	};

	const searchProvisions = async (_s: string = '') => {
		try {
			const _rq = await fetch(resolve(`/api/code-provisions?page=1&size=5&search=${_s}`));
			const _rs = await _rq.json();
			provisions_select = _rs.data?.length
				? parseSelectItemsV2(_rs.data, '$code - $descriptor', '_id')
				: [];
		} catch {
			provisions_select = [];
		}
	};

	const searchViolators = async (_s: string = '') => {
		try {
			const _rq = await fetch(resolve(`/api/violators?page=1&size=5&search=${_s}`));
			const _rs = await _rq.json();
			violators_select = _rs.data?.length ? _rs.data.map(violatorOption) : [];
		} catch {
			violators_select = [];
		}
	};

	const getViolatorData = async (_id: string) => {
		loading_violator = true;
		violator_error = '';
		invalid_violator_details = false;
		invalid_violator_errors = [];
		violator_details = undefined;
		photo_failed = false;

		try {
			const _rq = await fetch(resolve(`/api/violators/${_id}`));
			const _rs = await _rq.json();
			// a newer pick replaced this one while it loaded
			if ($form.recipient !== _id) return;

			if (!_rs.data) {
				violator_error = "Couldn't load this violator's profile.";
				return;
			}

			const details = await superValidate(_rs.data, zod4(Violator.Schema));
			if (!details.valid) {
				invalid_violator_details = true;
				invalid_violator_errors = getValidationErrors(details.errors);
				return;
			}
			violator_details = _rs.data;
		} catch {
			if ($form.recipient === _id) {
				violator_error = "Couldn't load this violator's profile. Check your connection.";
			}
		} finally {
			if ($form.recipient === _id) loading_violator = false;
		}
	};

	const getTicketSeries = async (ticket_assignment: string) => {
		series_select = [];
		try {
			const _rq = await fetch(
				resolve(`/api/ticket-assignments/${ticket_assignment}/get-series-number`)
			);
			const series = await _rq.json();
			if (series.is_fully_used) {
				$form.ticket_assignment = '';
				$errors.ticket_assignment = ['This pad has no unused tickets left. Pick another pad.'];
				return;
			}
			series_select = series.available_series;
			$form.ticket_series = Math.min(...series.available_series);
		} catch {
			$errors.ticket_assignment = ["Couldn't load this pad's series numbers. Pick it again."];
		}
	};

	// ---------- violator ----------

	// load the profile whenever the picked violator changes (picked, cleared, or pre-filled on reissue)
	let loaded_recipient = '';
	$effect(() => {
		const recipient = $form.recipient;
		untrack(() => {
			if (recipient === loaded_recipient) return;
			loaded_recipient = recipient;
			if (recipient) {
				getViolatorData(recipient);
			} else {
				violator_details = undefined;
				violator_error = '';
				invalid_violator_details = false;
				loading_violator = false;
			}
		});
	});

	// ---------- violations ----------

	let violation_details_cache = $state<Record<string, CodeProvision.Base>>({});
	let violation_details_failed = $state<Record<string, boolean>>({});
	// offense level depends on the violator, so it is cached per violator + provision
	let violation_levels_cache = $state<Record<string, number>>({});
	let violation_levels_failed = $state<Record<string, boolean>>({});
	// only guards against duplicate requests; nothing renders from it
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const in_flight = new Set<string>();

	const levelKey = (recipient: string, id: string) => `${recipient}:${id}`;

	const loadViolationDetail = async (id: string) => {
		const key = `detail:${id}`;
		if (in_flight.has(key)) return;
		in_flight.add(key);
		delete violation_details_failed[id];
		try {
			const _rq = await fetch(resolve(`/api/code-provisions/${id}`));
			const _rs = await _rq.json();
			if (_rs.data) violation_details_cache[id] = _rs.data;
			else violation_details_failed[id] = true;
		} catch {
			violation_details_failed[id] = true;
		} finally {
			in_flight.delete(key);
		}
	};

	const loadViolationLevel = async (recipient: string, id: string) => {
		const key = levelKey(recipient, id);
		if (in_flight.has(key)) return;
		in_flight.add(key);
		delete violation_levels_failed[key];
		try {
			const _rq = await fetch(resolve(`/api/issuances/${id}/get-level/${recipient}`));
			const _rs = await _rq.json();
			if (_rs.data) violation_levels_cache[key] = _rs.data;
			else violation_levels_failed[key] = true;
		} catch {
			violation_levels_failed[key] = true;
		} finally {
			in_flight.delete(key);
		}
	};

	$effect(() => {
		const ids = $form.violations;
		const recipient = $form.recipient;
		untrack(() => {
			for (const id of ids) {
				if (!(id in violation_details_cache) && !violation_details_failed[id]) {
					loadViolationDetail(id);
				}
				const key = levelKey(recipient, id);
				if (recipient && !(key in violation_levels_cache) && !violation_levels_failed[key]) {
					loadViolationLevel(recipient, id);
				}
			}
		});
	});

	const retryViolation = (id: string) => {
		if (!violation_details_cache[id]) loadViolationDetail(id);
		if ($form.recipient) loadViolationLevel($form.recipient, id);
	};

	const removeViolation = (id: string) => {
		$form.violations = $form.violations.filter((v) => v !== id);
	};

	const penaltyForLevel = (penalties: Penalty[] | undefined, level: number | undefined) => {
		if (!penalties?.length || !level) return undefined;
		return penalties[Math.max(Math.min(level - 1, penalties.length - 1), 0)];
	};

	const violation_rows: ViolationRow[] = $derived(
		$form.violations.map((id) => {
			const key = levelKey($form.recipient, id);
			const detail = violation_details_cache[id];
			const level = violation_levels_cache[key];
			return {
				id,
				detail,
				detail_failed: !!violation_details_failed[id],
				level,
				level_failed: !!violation_levels_failed[key],
				penalty: penaltyForLevel(detail?.penalty as Penalty[] | undefined, level)
			};
		})
	);

	const fine_total = $derived(
		violation_rows.reduce((sum, row) => sum + (row.penalty?.pecuniary ?? 0), 0)
	);
	// every row has its detail and its offense level, so the total is what will be billed
	const fine_total_final = $derived(
		violation_rows.every((row) => row.detail && (row.level || !row.detail.penalty))
	);
	const fine_total_failed = $derived(
		violation_rows.some((row) => row.detail_failed || row.level_failed)
	);

	// ---------- ticket ----------

	$effect(() => {
		if (!$form.ticket_assignment) {
			untrack(() => {
				series_select = [];
				selected_ticket_label = '';
			});
		}
	});

	// ---------- apprehension ----------

	const barangay_options = $derived(
		$form.apprehension_barangay && !city_barangays.includes($form.apprehension_barangay)
			? [$form.apprehension_barangay, ...city_barangays]
			: city_barangays
	);

	const useCurrentTime = () => {
		const now = new Date();
		$form.apprehension_date = now;
		$form.apprehension_time = now;
	};

	const apprehended_on = $derived(
		$apprehension_date_proxy && $apprehension_time_proxy
			? `${date.formatDate({ date: $apprehension_date_proxy, format: 'MMMM dd, yyyy' })} · ${date.formatTimev2($apprehension_time_proxy)}`
			: '—'
	);

	// ---------- receipt ----------

	const buildReceipt = (): Omit<Receipt, '_id' | 'tracking_code'> => ({
		violator_name: violator_details ? parseName(violator_details) : '',
		ticket_assignment: $form.ticket_assignment,
		ticket_label: selected_ticket_label,
		issuer: $form.issuer,
		series: $form.ticket_series,
		apprehended_on,
		apprehended_at: `${$form.apprehension_address}, ${$form.apprehension_barangay}`,
		violation_count: $form.violations.length,
		total: fine_total,
		total_final: fine_total_final
	});

	const issueAnother = () => {
		if (!receipt) return;
		const { ticket_assignment, ticket_label, issuer } = receipt;
		receipt = null;
		const now = new Date();
		super_form.reset({
			data: {
				ticket_assignment,
				issuer,
				apprehension_date: now,
				apprehension_time: now
			}
		});
		selected_ticket_label = ticket_label;
		if (ticket_assignment) getTicketSeries(ticket_assignment);
		goToStep(0);
	};

	message.subscribe((m) => {
		if (m?.type == 'error') toast.error(m.text);
	});

	onMount(() => {
		if (data.reissue_data) {
			const old_data = data.reissue_data;
			violators_select = [violatorOption(old_data.recipient)];
			// the reissued violations may not be in the first page of search results
			provisions_select = old_data.violations.map((v) => ({
				label: `${v.code} - ${v.descriptor}`,
				value: v.code_provision as unknown as string
			}));

			form.update(
				($f) => ({
					...$f,
					remarks: old_data.remarks,
					recipient: old_data.recipient._id,
					apprehension_address: old_data.apprehension_address,
					apprehension_barangay: old_data.apprehension_barangay,
					apprehension_date: new Date(old_data.apprehension_date),
					apprehension_time: new Date(old_data.apprehension_time),
					violations: old_data.violations.map((v) => v.code_provision as unknown as string),
					reissued_from: old_data._id,
					issuer: old_data.issuer._id
				}),
				{ taint: false }
			);

			searchTickets('', old_data.issuer._id);
		} else {
			const now = new Date();
			form.update(($f) => ({ ...$f, apprehension_date: now, apprehension_time: now }), {
				taint: false
			});
			searchTickets();
			searchViolators();
			searchProvisions();
		}
	});
</script>

<Header title={data.reissue_data ? 'Reissue Ticket' : 'Issue New Ticket'}>
	{#snippet PropFilter()}{/snippet}
</Header>

<div class="flex h-full min-h-0 w-full grow flex-row gap-6 p-3 md:p-4">
	<div class="flex h-full min-h-0 w-full grow flex-col gap-3">
		{#if !receipt}
			<!-- compact progress for phones; the full stepper sits on the right from md up -->
			<div class="flex flex-col gap-2 md:hidden">
				<div class="flex items-center justify-between gap-3">
					<p class="min-w-0 truncate text-sm">
						<span class="font-semibold">Step {form_step + 1} of {issuance_form_step.length}</span>
						<span class="text-base-content/70"> · {issuance_form_step[form_step]}</span>
					</p>
					<button class="btn btn-ghost btn-sm" type="button" onclick={discard}>Discard</button>
				</div>
				<progress
					class="progress h-1 progress-primary"
					value={form_step + 1}
					max={issuance_form_step.length}
					aria-label="Issuance progress"
				></progress>
			</div>
		{/if}

		<!-- Enter in a field moves to the next step instead of submitting the record -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<form
			class="min-h-0 w-full grow overflow-hidden rounded-box border border-base-300 bg-base-100 p-4 shadow-sm md:p-5"
			method="POST"
			action="?/create"
			novalidate
			use:enhance
			id="form"
			onkeydown={(e) => {
				if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing) return;
				const target = e.target as HTMLElement;
				if (['TEXTAREA', 'BUTTON', 'A', 'SELECT'].includes(target.tagName)) return;
				e.preventDefault();
				if (form_step < 4) next();
			}}
		>
			{#if receipt}
				{@render receipt_view(receipt)}
			{/if}

			<!-- STEP 0: Violator -->
			<section
				class={[
					'h-full w-full flex-col gap-4 overflow-auto',
					form_step == 0 && !receipt ? 'flex' : 'hidden'
				]}
				aria-labelledby="step-0-heading"
			>
				{@render step_heading(0)}

				<Combo
					label="Violator"
					name="recipient"
					placeholder="Search by name"
					options={violators_select}
					empty_error="No violator matches that name."
					on_search={(search: string) => searchViolators(search)}
					on_select={(selected: SelectItems) => {
						$form.recipient = selected.value as string;
					}}
					width="full"
					errors={$errors.recipient ? $errors.recipient : []}
					constraints={$constraints?.recipient ? $constraints?.recipient : {}}
					bind:value={$form.recipient}
				/>

				{#if loading_violator}
					<div class="flex w-full flex-1 items-center justify-center py-8" role="status">
						<span class="loading loading-md loading-spinner"></span>
						<span class="sr-only">Loading violator profile</span>
					</div>
				{:else if invalid_violator_details}
					<div
						class="flex w-full flex-col gap-3 rounded-box border border-error/30 bg-error/5 p-4 text-sm"
					>
						<p class="font-medium text-error">This violator's profile needs attention.</p>
						<p class="text-base-content/80">
							Update the following details before issuing a ticket:
						</p>
						<ul class="list-inside list-disc text-error">
							{#each invalid_violator_errors as error (error)}
								<li>{error}</li>
							{/each}
						</ul>
						<div class="flex flex-wrap gap-2">
							<a
								class="btn w-fit btn-soft btn-sm btn-error"
								href={resolve(`/u/violators/${$form.recipient}/edit`)}
								target="_blank"
								rel="noopener"
							>
								<Pencil class="size-4" /> Edit violator
								<ExternalLink class="size-3.5" aria-label="opens in a new tab" />
							</a>
							<button
								class="btn w-fit btn-ghost btn-sm"
								type="button"
								onclick={() => getViolatorData($form.recipient)}
							>
								<RefreshCw class="size-4" /> Check again
							</button>
						</div>
						<p class="text-xs text-base-content/70">
							The editor opens in a new tab, so this ticket stays as it is. Come back and press
							"Check again" once you've saved.
						</p>
					</div>
				{:else if violator_details}
					<div
						class="flex w-full flex-col items-start gap-4 rounded-box border border-base-300 bg-base-200/40 p-4 sm:flex-row sm:p-5"
					>
						<div class="avatar shrink-0">
							<div class="size-20 rounded-xl bg-base-300 sm:size-36">
								{#if violator_details.profile_image && !photo_failed}
									<img
										src={getPreviewUrl() + violator_details.profile_image}
										alt={`Photo of ${parseName(violator_details)}`}
										onerror={() => (photo_failed = true)}
									/>
								{:else}
									<div
										class="flex h-full w-full items-center justify-center text-3xl font-semibold text-base-content/70"
										aria-hidden="true"
									>
										{violator_details.firstname[0]}
									</div>
								{/if}
							</div>
						</div>

						<div class="flex min-w-0 flex-1 flex-col gap-3">
							<div>
								<p class="text-lg font-semibold">{parseName(violator_details)}</p>
								<p class="text-sm text-base-content/70">
									{violator_details.birthdate
										? `Born ${date.formatDate({ date: violator_details.birthdate, format: 'MMM dd, yyyy' })}`
										: 'Birthdate unavailable'}
								</p>
							</div>

							<dl class="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6">
								<div class="flex flex-col gap-0.5 sm:col-span-2">
									<dt class="text-xs text-base-content/60">Address</dt>
									<dd class="text-sm wrap-break-word">{formatAddress(violator_details)}</dd>
								</div>
								<div class="flex flex-col gap-0.5">
									<dt class="text-xs text-base-content/60">License no.</dt>
									<dd class="text-sm tabular-nums">{violator_details.license_number || '—'}</dd>
								</div>
								<div class="flex flex-col gap-0.5">
									<dt class="text-xs text-base-content/60">Contact no.</dt>
									<dd class="text-sm tabular-nums">{violator_details.contact_number ?? '—'}</dd>
								</div>
							</dl>
						</div>
					</div>
				{:else if violator_error}
					<div
						class="flex w-full flex-col items-center justify-center gap-3 py-8 text-center text-sm"
						role="alert"
					>
						<p class="text-error">{violator_error}</p>
						<button
							class="btn btn-soft btn-sm"
							type="button"
							onclick={() => getViolatorData($form.recipient)}
						>
							<RefreshCw class="size-4" /> Retry
						</button>
					</div>
				{:else}
					<p
						class="flex w-full flex-1 items-center justify-center py-8 text-center text-sm text-base-content/60"
					>
						The violator's photo and details appear here once you pick a name.
					</p>
				{/if}
			</section>

			<!-- STEP 1: Ticket -->
			<section
				class={[
					'h-full w-full flex-col gap-1 overflow-auto',
					form_step == 1 && !receipt ? 'flex' : 'hidden'
				]}
				aria-labelledby="step-1-heading"
			>
				<div class="mb-3">{@render step_heading(1)}</div>

				<div class="flex w-full flex-col gap-x-4 sm:flex-row">
					<div class="min-w-0 grow">
						<Combo
							label="Ticket pad"
							name="ticket_assignment"
							placeholder="Search your assigned pads"
							options={tickets_select}
							empty_error="No ticket pads are assigned to you. Ask your office in-charge to assign one."
							on_search={(search: string) => searchTickets(search, $form.issuer)}
							on_select={(selected: SelectItems) => {
								$form.ticket_assignment = selected.value as string;
								selected_ticket_label = selected.label;
								if (selected.value) getTicketSeries(selected.value as string);
							}}
							width="full"
							errors={$errors.ticket_assignment ? $errors.ticket_assignment : []}
							constraints={$constraints?.ticket_assignment ? $constraints?.ticket_assignment : {}}
							bind:value={$form.ticket_assignment}
						/>
					</div>

					<fieldset class="fieldset sm:w-48">
						<legend class="fieldset-legend">Series no.<span class="text-error">*</span></legend>

						<select
							id="ticket_series"
							name="ticket_series"
							class="select w-full font-semibold tabular-nums"
							class:border-error={$errors.ticket_series?.length}
							bind:value={$form.ticket_series}
							{...$constraints.ticket_series}
							disabled={!series_select.length}
							aria-invalid={$errors.ticket_series ? true : undefined}
							aria-describedby="ticket_series-hint ticket_series-error"
						>
							{#each series_select as series_item (series_item)}
								<option value={series_item}>{series_item}</option>
							{:else}
								<option disabled selected>Pick a pad first</option>
							{/each}
						</select>
						<InputError id="ticket_series-error">
							{$errors.ticket_series && $errors.ticket_series[0]}
						</InputError>
					</fieldset>
				</div>
				<p id="ticket_series-hint" class="-mt-2 text-xs text-base-content/70">
					The series number must match the number printed on the paper ticket you're writing.
				</p>

				<fieldset class="fieldset mt-2 w-full">
					<legend class="fieldset-legend">
						Remarks <span class="font-normal text-base-content/60">(optional)</span>
					</legend>

					<textarea
						id="remarks"
						name="remarks"
						rows="2"
						class="textarea max-h-24 w-full"
						class:border-error={$errors.remarks?.length}
						placeholder="Anything the office should know about this citation"
						bind:value={$form.remarks}
						{...$constraints.remarks}
						aria-invalid={$errors.remarks ? true : undefined}
						aria-describedby="remarks-error"
					></textarea>
					<InputError id="remarks-error">
						{$errors.remarks && $errors.remarks[0]}
					</InputError>
				</fieldset>
			</section>

			<!-- STEP 2: Violations -->
			<section
				class={[
					'h-full min-h-0 w-full flex-col gap-4 overflow-auto',
					form_step == 2 && !receipt ? 'flex' : 'hidden'
				]}
				aria-labelledby="step-2-heading"
			>
				{@render step_heading(2)}

				<Combobox
					label="Violations"
					name="violations"
					placeholder="Search by code or description"
					options={provisions_select}
					empty_error="No violation matches that search."
					on_search={(search: string) => searchProvisions(search)}
					multiple
					width="full"
					errors={$errors.violations?._errors ?? []}
					constraints={$constraints?.violations ? $constraints?.violations : {}}
					bind:value={$form.violations}
					disabled_chip_list={true}
				/>

				<div class="flex min-h-0 grow flex-col rounded-box border border-base-300">
					{#if $form.violations.length === 0}
						<p
							class="flex grow items-center justify-center p-6 text-center text-sm text-base-content/60"
						>
							Violations you add appear here with their fine.
						</p>
					{:else}
						<div class="min-h-0 grow overflow-auto">
							{@render violation_list(true)}
						</div>
						{@render fine_total_row()}
					{/if}
				</div>
			</section>

			<!-- STEP 3: Apprehension details -->
			<section
				class={[
					'h-full w-full flex-col gap-1 overflow-auto',
					form_step == 3 && !receipt ? 'flex' : 'hidden'
				]}
				aria-labelledby="step-3-heading"
			>
				<div class="mb-3">{@render step_heading(3)}</div>

				<div class="flex w-full flex-col gap-x-4 sm:flex-row sm:items-end">
					<fieldset class="fieldset flex-1">
						<legend class="fieldset-legend">Date<span class="text-error">*</span></legend>
						<input
							id="apprehension_date"
							type="date"
							class="input w-full"
							class:border-error={$errors.apprehension_date}
							name="apprehension_date"
							max={today}
							bind:value={$apprehension_date_proxy}
							{...$constraints.apprehension_date}
							aria-invalid={$errors.apprehension_date ? true : undefined}
							aria-describedby="apprehension_date-error"
						/>
						<InputError id="apprehension_date-error"
							>{$errors.apprehension_date && $errors?.apprehension_date[0]}</InputError
						>
					</fieldset>

					<fieldset class="fieldset flex-1">
						<legend class="fieldset-legend">Time<span class="text-error">*</span></legend>
						<input
							id="apprehension_time"
							type="time"
							class="input w-full"
							class:border-error={$errors.apprehension_time}
							name="apprehension_time"
							bind:value={$apprehension_time_proxy}
							{...$constraints.apprehension_time}
							aria-invalid={$errors.apprehension_time ? true : undefined}
							aria-describedby="apprehension_time-error"
						/>
						<InputError id="apprehension_time-error"
							>{$errors.apprehension_time && $errors?.apprehension_time[0]}</InputError
						>
					</fieldset>

					<button
						class="btn mb-6 self-start btn-soft sm:self-end"
						type="button"
						onclick={useCurrentTime}
					>
						<Clock class="size-4" /> Use current time
					</button>
				</div>

				<fieldset class="fieldset w-full">
					<legend class="fieldset-legend">Barangay<span class="text-error">*</span></legend>
					<select
						id="apprehension_barangay"
						class="select w-full"
						class:border-error={$errors.apprehension_barangay}
						name="apprehension_barangay"
						bind:value={$form.apprehension_barangay}
						aria-invalid={$errors.apprehension_barangay ? true : undefined}
						aria-describedby="apprehension_barangay-error"
					>
						<option value="" disabled>Select a barangay</option>
						{#each barangay_options as barangay (barangay)}
							<option value={barangay}>{barangay}</option>
						{/each}
					</select>
					<InputError id="apprehension_barangay-error"
						>{$errors.apprehension_barangay && $errors?.apprehension_barangay[0]}</InputError
					>
				</fieldset>

				<fieldset class="fieldset w-full">
					<legend class="fieldset-legend">At or near<span class="text-error">*</span></legend>
					<textarea
						id="apprehension_address"
						rows="2"
						class="textarea max-h-28 w-full"
						class:border-error={$errors.apprehension_address}
						placeholder="Ocean View Park"
						name="apprehension_address"
						bind:value={$form.apprehension_address}
						{...$constraints.apprehension_address}
						aria-invalid={$errors.apprehension_address ? true : undefined}
						aria-describedby="apprehension_address-hint apprehension_address-error"
					></textarea>
					<p id="apprehension_address-hint" class="text-xs text-base-content/70">
						The street, landmark or establishment closest to where it happened.
					</p>
					<InputError id="apprehension_address-error"
						>{$errors.apprehension_address && $errors?.apprehension_address[0]}</InputError
					>
				</fieldset>
			</section>

			<!-- STEP 4: Review -->
			<section
				class={[
					'h-full w-full flex-col gap-4 overflow-auto',
					form_step == 4 && !receipt ? 'flex' : 'hidden'
				]}
				aria-labelledby="step-4-heading"
			>
				{@render step_heading(4)}

				<div class="flex flex-col divide-y divide-base-300">
					{#snippet review_heading(title: string, step: number)}
						<div class="flex items-center justify-between gap-3">
							<h3 class="text-sm font-semibold">{title}</h3>
							<button
								class="btn btn-ghost btn-sm"
								type="button"
								onclick={() => goToStep(step)}
								aria-label={`Edit ${title.toLowerCase()}`}
							>
								<Pencil class="size-3.5" /> Edit
							</button>
						</div>
					{/snippet}

					<div class="flex flex-col gap-3 pb-4">
						{@render review_heading('Violator', 0)}
						{#if violator_details}
							<div class="flex items-center gap-3">
								<div class="avatar shrink-0">
									<div class="size-14 rounded-lg bg-base-300">
										{#if violator_details.profile_image && !photo_failed}
											<img src={getPreviewUrl() + violator_details.profile_image} alt="" />
										{:else}
											<div
												class="flex h-full w-full items-center justify-center text-lg font-semibold text-base-content/70"
												aria-hidden="true"
											>
												{violator_details.firstname[0]}
											</div>
										{/if}
									</div>
								</div>
								<div class="min-w-0 text-sm">
									<p class="font-medium">{parseName(violator_details)}</p>
									<p class="text-base-content/70">
										{[
											violator_details.birthdate
												? `Born ${date.formatDate({ date: violator_details.birthdate, format: 'MMM dd, yyyy' })}`
												: '',
											violator_details.license_number
												? `Lic. ${violator_details.license_number}`
												: ''
										]
											.filter(Boolean)
											.join(' · ') || 'No birthdate or license on file'}
									</p>
									<p class="wrap-break-word text-base-content/70">
										{formatAddress(violator_details)}
									</p>
								</div>
							</div>
						{/if}
					</div>

					<div class="flex flex-col gap-3 py-4">
						{@render review_heading('Ticket', 1)}
						<dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
							<div class="flex flex-col gap-0.5">
								<dt class="text-xs text-base-content/60">Pad</dt>
								<dd>{selected_ticket_label || '—'}</dd>
							</div>
							<div class="flex flex-col gap-0.5">
								<dt class="text-xs text-base-content/60">Series no.</dt>
								<dd class="text-lg font-semibold tabular-nums">{$form.ticket_series}</dd>
							</div>
							<div class="col-span-2 flex flex-col gap-0.5">
								<dt class="text-xs text-base-content/60">Remarks</dt>
								<dd class="wrap-break-word">{$form.remarks || '—'}</dd>
							</div>
						</dl>
					</div>

					<div class="flex flex-col gap-3 py-4">
						{@render review_heading('Apprehension', 3)}
						<dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
							<div class="flex flex-col gap-0.5">
								<dt class="text-xs text-base-content/60">Apprehended on</dt>
								<dd>{apprehended_on}</dd>
							</div>
							<div class="flex flex-col gap-0.5">
								<dt class="text-xs text-base-content/60">At or near</dt>
								<dd class="wrap-break-word">
									{$form.apprehension_address}, {$form.apprehension_barangay}
								</dd>
							</div>
						</dl>
					</div>

					<div class="flex flex-col gap-3 pt-4">
						{@render review_heading('Violations', 2)}
						<div class="rounded-box border border-base-300">
							{@render violation_list(false)}
							{@render fine_total_row()}
						</div>
					</div>
				</div>
			</section>
		</form>

		{#if !receipt}
			{#if step_error}
				<div role="alert" class="alert alert-soft text-sm alert-error">
					<TriangleAlert class="size-4 shrink-0" />
					<span>{step_error}</span>
				</div>
			{/if}

			{#if form_step === 4}
				<p class="text-sm text-base-content/80">
					Issuing creates an official citation and a billing of
					<span class="font-semibold tabular-nums"
						>{fine_total_final ? peso(fine_total) : 'the fines listed above'}</span
					>
					for
					<span class="font-semibold">{violator_details ? parseName(violator_details) : ''}</span>.
				</p>
			{/if}

			<div class="flex w-full flex-row justify-between gap-2">
				<button
					class="btn flex-1 btn-soft btn-lg md:w-32 md:flex-none md:btn-md"
					type="button"
					onclick={() => goToStep(form_step - 1)}
					disabled={form_step == 0 || $submitting}>Back</button
				>
				{#if form_step < 4}
					<button
						class="btn flex-2 btn-lg btn-primary md:min-w-32 md:flex-none md:btn-md"
						type="button"
						onclick={next}
					>
						Next<span class="hidden sm:inline">: {issuance_form_step[form_step + 1]}</span>
					</button>
				{:else}
					<button
						class="btn flex-2 btn-lg btn-primary md:min-w-48 md:flex-none md:btn-md"
						type="button"
						onclick={issue}
						disabled={$submitting}
						aria-busy={$submitting}
					>
						{#if $submitting}
							<span class="loading loading-sm loading-spinner"></span> Issuing…
						{:else}
							<Check class="size-4" /> Issue ticket #{$form.ticket_series}
						{/if}
					</button>
				{/if}
			</div>
		{/if}
	</div>

	{#if !receipt}
		<nav class="hidden w-48 shrink-0 flex-col gap-6 md:flex" aria-label="Issuance steps">
			<ol class="steps steps-vertical h-fit text-sm">
				{#each issuance_form_step as step, index (index)}
					<li
						class={['step', index <= form_step && 'step-primary']}
						aria-current={index === form_step ? 'step' : undefined}
					>
						{#if index < form_step}
							<span class="step-icon">
								<Check class="size-4 stroke-primary-content" />
							</span>
						{/if}
						{#if index < form_step && !$submitting}
							<button
								class="link text-left link-hover"
								type="button"
								onclick={() => goToStep(index)}
							>
								{step}
							</button>
						{:else}
							<span
								class={[
									index === form_step && 'font-semibold text-primary',
									index > form_step && 'text-base-content/60'
								]}
							>
								{step}
							</span>
						{/if}
					</li>
				{/each}
			</ol>

			<button class="btn w-full btn-ghost btn-sm" type="button" onclick={discard}>
				Discard ticket
			</button>
		</nav>
	{/if}
</div>

{#snippet step_heading(step: number)}
	<div class="flex flex-col gap-0.5">
		<h2 id={`step-${step}-heading`} tabindex="-1" class="text-base font-semibold outline-none">
			{step === 4 ? 'Review and issue' : issuance_form_step[step]}
		</h2>
		<p class="text-sm text-base-content/70">{step_hints[step]}</p>
	</div>
{/snippet}

{#snippet violation_list(editable: boolean)}
	<ul class="divide-y divide-base-300">
		{#each violation_rows as row, index (row.id)}
			<li class="flex flex-col gap-2 p-4">
				<div class="flex items-start justify-between gap-3">
					<div class="flex min-w-0 flex-col gap-0.5">
						<span class="text-xs text-base-content/60 tabular-nums">#{index + 1}</span>
						{#if row.detail}
							<span class="text-sm font-medium wrap-break-word">{row.detail.code}</span>
							<span class="text-sm wrap-break-word text-base-content/70"
								>{row.detail.descriptor}</span
							>
						{:else if row.detail_failed}
							<span class="text-sm text-error">Couldn't load this violation.</span>
						{:else}
							<span class="h-4 w-40 skeleton"></span>
						{/if}
					</div>

					<div class="flex shrink-0 items-center gap-1">
						{#if row.level}
							<span class="badge whitespace-nowrap badge-soft badge-primary">
								{getNumberOrdinal(row.level)} offense
							</span>
						{:else if !row.level_failed}
							<span class="h-5 w-20 skeleton" aria-label="Checking offense history"></span>
						{/if}
						{#if editable}
							<button
								class="btn btn-square btn-ghost btn-sm"
								type="button"
								aria-label={`Remove ${row.detail?.code ?? 'violation'}`}
								onclick={() => removeViolation(row.id)}
							>
								<X class="size-4" />
							</button>
						{/if}
					</div>
				</div>

				{#if row.detail_failed || row.level_failed}
					<div class="flex flex-wrap items-center gap-2 text-sm">
						<span class="text-base-content/70">
							{row.level_failed && !row.detail_failed
								? "Couldn't check this violator's offense history. The fine is set when you issue."
								: 'Check your connection and try again.'}
						</span>
						<button
							class="btn btn-ghost btn-xs"
							type="button"
							onclick={() => retryViolation(row.id)}
						>
							<RefreshCw class="size-3.5" /> Retry
						</button>
					</div>
				{:else if row.penalty}
					<div class="flex flex-col gap-1.5 rounded-box bg-base-200/40 p-3 text-sm">
						{#if row.penalty.pecuniary}
							<div class="flex items-center gap-2">
								<span class="text-xs text-base-content/60">Fine</span>
								<span class="font-medium tabular-nums">{peso(row.penalty.pecuniary)}</span>
							</div>
						{/if}
						{#if row.penalty.disciplinary}
							<div class="flex flex-col gap-0.5">
								<span class="text-xs text-base-content/60">Disciplinary action</span>
								<span class="text-wrap wrap-break-word">{row.penalty.disciplinary}</span>
							</div>
						{/if}
					</div>
				{:else if row.detail && row.level}
					<span class="text-sm text-base-content/60">No penalty on file.</span>
				{:else if !row.detail_failed}
					<span class="h-10 w-full skeleton"></span>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet fine_total_row()}
	<div
		class="flex items-center justify-between gap-3 border-t border-base-300 bg-base-200/40 px-4 py-3"
	>
		<span class="text-sm font-medium">Total fine</span>
		{#if fine_total_final}
			<span class="text-lg font-semibold tabular-nums">{peso(fine_total)}</span>
		{:else if fine_total_failed}
			<span class="text-sm text-base-content/70">Set when you issue</span>
		{:else}
			<span class="text-sm text-base-content/70" role="status">Calculating…</span>
		{/if}
	</div>
{/snippet}

{#snippet receipt_view(r: Receipt)}
	<section
		class="flex h-full w-full flex-col gap-6 overflow-auto"
		aria-labelledby="receipt-heading"
	>
		<div class="flex flex-col items-center gap-2 pt-4 text-center">
			<CircleCheck class="size-10 text-success" aria-hidden="true" />
			<h2 id="receipt-heading" tabindex="-1" class="text-lg font-semibold outline-none">
				Ticket issued
			</h2>
			<p class="text-sm text-base-content/70">Tracking code</p>
			<p class="font-mono text-2xl font-semibold tracking-wider select-all">{r.tracking_code}</p>
		</div>

		<dl class="mx-auto grid w-full max-w-xl grid-cols-2 gap-x-6 gap-y-4 text-sm">
			<div class="col-span-2 flex flex-col gap-0.5">
				<dt class="text-xs text-base-content/60">Violator</dt>
				<dd class="font-medium">{r.violator_name}</dd>
			</div>
			<div class="flex flex-col gap-0.5">
				<dt class="text-xs text-base-content/60">Pad</dt>
				<dd>{r.ticket_label || '—'}</dd>
			</div>
			<div class="flex flex-col gap-0.5">
				<dt class="text-xs text-base-content/60">Series no.</dt>
				<dd class="font-semibold tabular-nums">{r.series}</dd>
			</div>
			<div class="col-span-2 flex flex-col gap-0.5">
				<dt class="text-xs text-base-content/60">Apprehended</dt>
				<dd>{r.apprehended_on} · {r.apprehended_at}</dd>
			</div>
			<div class="flex flex-col gap-0.5">
				<dt class="text-xs text-base-content/60">Violations</dt>
				<dd class="tabular-nums">{r.violation_count}</dd>
			</div>
			<div class="flex flex-col gap-0.5">
				<dt class="text-xs text-base-content/60">Total fine</dt>
				<dd class="font-semibold tabular-nums">
					{r.total_final ? peso(r.total) : 'See the ticket record'}
				</dd>
			</div>
		</dl>

		<div class="mx-auto flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:justify-center">
			<button class="btn btn-primary max-sm:btn-lg" type="button" onclick={issueAnother}>
				Issue another from this pad
			</button>
			<a class="btn btn-soft max-sm:btn-lg" href={resolve(`/u/issuance/${r._id}/status`)}>
				View ticket
			</a>
			<a class="btn btn-ghost max-sm:btn-lg" href={resolve('/u/issuance')}>All issued tickets</a>
		</div>
	</section>
{/snippet}

<dialog class="modal p-2" bind:this={dialog} aria-labelledby="discard-heading">
	<div class="relative modal-box flex w-full flex-col gap-4 md:w-5/12">
		<h3 id="discard-heading" class="pr-8 font-semibold">Discard this ticket?</h3>

		<p class="text-sm text-base-content/80">
			Nothing has been issued yet. What you've entered on this form will be lost.
		</p>

		<div class="modal-action mt-0">
			<button class="btn btn-ghost" type="button" onclick={() => dialog.close()}>
				Keep editing
			</button>
			<button
				class="btn btn-soft btn-error"
				type="button"
				onclick={async () => {
					// clear the taint so the unsaved-changes guard doesn't ask a second time
					super_form.reset();
					dialog.close();
					await goto(resolve('/u/issuance'));
				}}
			>
				Discard ticket
			</button>

			<button
				class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm"
				type="button"
				aria-label="Close"
				onclick={() => dialog.close()}
				><X class="size-4" />
			</button>
		</div>
	</div>

	<form method="dialog" class="modal-backdrop h-dvh">
		<button aria-label="Keep editing">Close</button>
	</form>
</dialog>
