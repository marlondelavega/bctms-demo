<script lang="ts">
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import Login from '$lib/validation_schemas/Login.zod.js';
	import { Eye, EyeOff, ShieldCheck } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { superForm } from 'sveltekit-superforms/client';

	const { data } = $props();

	const super_form = superForm(data.form, {
		dataType: 'json',
		validators: zod4Client(Login.ChangePasswordSchema)
	});

	const { form, errors, enhance, message, constraints } = super_form;

	let show_current = $state(false);
	let show_new = $state(false);
	let show_confirm = $state(false);

	let strength = $derived.by(() => {
		const value = $form.new_password ?? '';
		if (!value) return 0;
		let score = 0;
		if (value.length >= 8) score++;
		if (value.length >= 12) score++;
		if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
		if (/\d/.test(value)) score++;
		if (/[^A-Za-z0-9]/.test(value)) score++;
		return score;
	});

	const strength_label = $derived.by(() => {
		if (!$form.new_password) return '';
		if (strength <= 1) return 'Weak';
		if (strength <= 3) return 'Okay';
		return 'Strong';
	});

	const strength_class = $derived.by(() => {
		if (strength <= 1) return 'bg-error';
		if (strength <= 3) return 'bg-warning';
		return 'bg-success';
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
</script>

<div class="flex flex-col gap-6">
	<div>
		<h2 class="flex items-center gap-2 text-sm font-medium">
			<ShieldCheck class="size-4 text-base-content/50" />
			Change password
		</h2>
		<p class="text-xs text-base-content/50">Use a password you don't use anywhere else.</p>
	</div>

	<form
		class="flex max-w-md flex-col gap-4"
		method="POST"
		action="?/change_password"
		novalidate
		use:enhance
	>
		<fieldset class="fieldset w-full">
			<legend class="fieldset-legend">Current password<span class="text-error">*</span></legend>
			<div class="join w-full">
				<input
					type={show_current ? 'text' : 'password'}
					class="input join-item w-full"
					class:border-error={$errors.current_password?.length}
					name="current_password"
					autocomplete="current-password"
					bind:value={$form.current_password}
					{...$constraints.current_password}
					aria-invalid={$errors.current_password ? true : undefined}
				/>
				<button
					type="button"
					class="btn join-item btn-square"
					onclick={() => (show_current = !show_current)}
					aria-label={show_current ? 'Hide password' : 'Show password'}
				>
					{#if show_current}
						<EyeOff class="size-4" />
					{:else}
						<Eye class="size-4" />
					{/if}
				</button>
			</div>
			<InputError>{$errors.current_password && $errors.current_password[0]}</InputError>
		</fieldset>

		<div class="divider my-0"></div>

		<fieldset class="fieldset w-full">
			<legend class="fieldset-legend">New password<span class="text-error">*</span></legend>
			<div class="join w-full">
				<input
					type={show_new ? 'text' : 'password'}
					class="input join-item w-full"
					class:border-error={$errors.new_password?.length}
					name="new_password"
					autocomplete="new-password"
					bind:value={$form.new_password}
					{...$constraints.new_password}
					aria-invalid={$errors.new_password ? true : undefined}
				/>
				<button
					type="button"
					class="btn join-item btn-square"
					onclick={() => (show_new = !show_new)}
					aria-label={show_new ? 'Hide password' : 'Show password'}
				>
					{#if show_new}
						<EyeOff class="size-4" />
					{:else}
						<Eye class="size-4" />
					{/if}
				</button>
			</div>

			{#if $form.new_password}
				<div class="mt-1 flex items-center gap-2">
					<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-base-300">
						<div
							class={['h-full transition-all', strength_class]}
							style={`width: ${(strength / 5) * 100}%`}
						></div>
					</div>
					<span class="w-10 shrink-0 text-right text-xs text-base-content/50">
						{strength_label}
					</span>
				</div>
			{/if}

			<InputError>{$errors.new_password && $errors.new_password[0]}</InputError>
		</fieldset>

		<fieldset class="fieldset w-full">
			<legend class="fieldset-legend"
				>Confirm new password<span class="text-error">*</span>
			</legend>
			<div class="join w-full">
				<input
					type={show_confirm ? 'text' : 'password'}
					class="input join-item w-full"
					class:border-error={$errors.confirm_password?.length}
					name="confirm_password"
					autocomplete="new-password"
					bind:value={$form.confirm_password}
					{...$constraints.confirm_password}
					aria-invalid={$errors.confirm_password ? true : undefined}
				/>
				<button
					type="button"
					class="btn join-item btn-square"
					onclick={() => (show_confirm = !show_confirm)}
					aria-label={show_confirm ? 'Hide password' : 'Show password'}
				>
					{#if show_confirm}
						<EyeOff class="size-4" />
					{:else}
						<Eye class="size-4" />
					{/if}
				</button>
			</div>
			<InputError>{$errors.confirm_password && $errors.confirm_password[0]}</InputError>
		</fieldset>

		<button class="btn mt-2 w-fit btn-primary" type="submit">Update password</button>
	</form>
</div>
