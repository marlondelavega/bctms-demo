<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms/client';
	import { X } from '@lucide/svelte';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import type EnforcementGroup from '$lib/validation_schemas/EnforcementGroups.zod';
	import Incentive from '$lib/validation_schemas/Incentives.zod';

	let {
		superform,
		group_name
	}: {
		superform: SuperForm<EnforcementGroup.Incentive, App.Superforms.Message>;
		group_name: string;
	} = $props();

	let { form, errors, enhance, delayed } = $derived(superform);
	let dialog: HTMLDialogElement;

	const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

	// a worked example, so the setting reads as what an officer actually gets
	const example = $derived.by(() => {
		const amount = Number($form.amount) || 0;
		if (!amount) return '';
		if ($form.rate_type === 'fixed') return `${peso.format(amount)} for every qualifying ticket.`;
		const base = $form.basis === 'paid' ? 'amount paid' : 'fine';
		return `${amount}% of each ticket’s ${base} — e.g. ${peso.format((1000 * amount) / 100)} on a ₱1,000 ${base}.`;
	});
</script>

<dialog id="group_incentive" class="modal p-2 backdrop-blur-xs" bind:this={dialog}>
	<div class="relative modal-box flex w-full max-w-lg flex-col gap-4">
		<div class="flex flex-col gap-0.5">
			<h3 class="font-bold">Incentive settings</h3>
			<p class="text-xs text-base-content/60">
				{group_name} · the starting values when generating incentive reports for this group. They can
				still be changed per report, with a reason.
			</p>
		</div>

		<form method="POST" action="?/incentive" use:enhance novalidate class="flex flex-col gap-3">
			<label class="flex cursor-pointer items-center justify-between gap-3">
				<span class="flex flex-col">
					<span class="text-sm font-medium">Incentives enabled</span>
					<span class="text-xs text-base-content/60">
						When off, this group starts excluded on the generate form.
					</span>
				</span>
				<input type="checkbox" class="toggle toggle-primary" bind:checked={$form.enabled} />
			</label>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">Rate<span class="text-error">*</span></legend>
				<div class="join w-full">
					{#each Incentive.RATE_TYPES as t (t.value)}
						<input
							type="radio"
							name="rate_type"
							class="btn join-item grow btn-sm"
							aria-label={t.label}
							value={t.value}
							bind:group={$form.rate_type}
						/>
					{/each}
				</div>
				<InputError>{$errors.rate_type && $errors.rate_type[0]}</InputError>
			</fieldset>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">
					{$form.rate_type === 'fixed' ? 'Amount per ticket' : 'Percentage'}<span class="text-error"
						>*</span
					>
				</legend>
				<label class={['input w-full', $errors.amount && 'input-error']}>
					{#if $form.rate_type === 'fixed'}<span class="text-base-content/60">₱</span>{/if}
					<input
						type="number"
						min="0"
						step="0.01"
						max={$form.rate_type === 'percentage' ? 100 : undefined}
						class="grow tabular-nums"
						placeholder={$form.rate_type === 'fixed' ? '50.00' : '5'}
						bind:value={$form.amount}
						aria-invalid={$errors.amount ? true : undefined}
					/>
					{#if $form.rate_type === 'percentage'}<span class="text-base-content/60">%</span>{/if}
				</label>
				<InputError>{$errors.amount && $errors.amount[0]}</InputError>
			</fieldset>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">Count<span class="text-error">*</span></legend>
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{#each Incentive.BASES as b (b.value)}
						<label
							class={[
								'flex cursor-pointer flex-col gap-0.5 rounded-field border p-3',
								$form.basis === b.value ? 'border-primary bg-primary/5' : 'border-base-300'
							]}
						>
							<span class="flex items-center gap-2 text-sm font-medium">
								<input
									type="radio"
									name="basis"
									class="radio radio-xs radio-primary"
									value={b.value}
									bind:group={$form.basis}
								/>
								{b.label}
							</span>
							<span class="text-xs text-base-content/60">{b.hint}</span>
						</label>
					{/each}
				</div>
				<InputError>{$errors.basis && $errors.basis[0]}</InputError>
			</fieldset>

			{#if example}
				<p class="rounded-field bg-base-200 px-3 py-2 text-xs">{example}</p>
			{/if}

			<div class="modal-action mt-0">
				<button class="btn btn-ghost" type="button" onclick={() => dialog.close()}>Close</button>
				<button class="btn btn-primary" type="submit">
					{#if $delayed}
						<span class="loading loading-xs loading-spinner"></span>
					{:else}
						Save
					{/if}
				</button>
			</div>

			<button
				class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm"
				type="button"
				aria-label="Close"
				onclick={() => dialog.close()}><X class="size-4" /></button
			>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop h-dvh">
		<button>x</button>
	</form>
</dialog>
