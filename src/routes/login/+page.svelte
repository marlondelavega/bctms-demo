<script lang="ts">
	import { resolve } from '$app/paths';
	import InputError from '$lib/ui/components/input/InputError.svelte';
	import type Login from '$lib/validation_schemas/Login.zod.js';
	import lguSeal from '$lib/assets/lgu_seal.svg';
	import { lgu } from '$lib/data/lgu';
	import { Eye, EyeClosed, LoaderCircle, UserRound } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { superForm, type SuperForm } from 'sveltekit-superforms/client';

	let show = $state(false);
	let { data } = $props();

	const {
		form,
		enhance,
		message,
		constraints,
		errors,
		delayed
	}: SuperForm<Login.Credentials, App.Superforms.Message> = superForm(data.login_form, {
		delayMs: 500,
		timeoutMs: 8000
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

<div class="grid min-h-dvh w-full lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
	<aside
		class="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-content lg:flex"
	>
		<div
			class="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-primary-content/10"
			aria-hidden="true"
		></div>
		<div
			class="pointer-events-none absolute -right-6 -bottom-6 size-48 rounded-full bg-primary-content/10"
			aria-hidden="true"
		></div>
		<span class="text-lg font-semibold tracking-tight">CiteTicket</span>
		<div class="relative flex max-w-sm flex-col gap-6">
			<img src={lguSeal} alt="Seal of the {lgu.name}" class="size-20" />
			<h2 class="text-3xl leading-tight font-semibold text-balance">
				Every citation, from booklet to payment.
			</h2>
			<p class="text-primary-content/80">Citation Ticket Management System</p>
		</div>
		<p class="text-sm text-primary-content/80">{lgu.name}</p>
	</aside>

	<main class="flex min-h-dvh flex-col">
		<a class="flex items-center gap-2 p-6 sm:p-8 lg:hidden" href={resolve('/')}>
			<svg
				id="CiteTicket_logo"
				xmlns="http://www.w3.org/2000/svg"
				version="1.1"
				xmlns:xlink="http://www.w3.org/1999/xlink"
				viewBox="0 0 24 24"
				class="size-8"
			>
				<defs>
					<style>
						.st0 {
							fill: url(#linear-gradient2);
						}

						.st1 {
							fill: url(#linear-gradient1);
						}

						.st2 {
							fill: #605dff;
						}

						.st3 {
							fill: url(#linear-gradient);
						}
					</style>
					<linearGradient
						id="linear-gradient"
						x1="13.75"
						y1="6.89"
						x2="13.75"
						y2="17.3"
						gradientUnits="userSpaceOnUse"
					>
						<stop offset="0" stop-color="#605dff" />
						<stop offset="1" stop-color="#605dff" stop-opacity="0" />
					</linearGradient>
					<linearGradient
						id="linear-gradient1"
						y1="7.78"
						y2="17.09"
						xlink:href="#linear-gradient"
					/>
					<linearGradient id="linear-gradient2" y1="6.89" y2="17.3" xlink:href="#linear-gradient" />
				</defs>

				<path
					class="st2 fill-primary"
					d="M8.47,8.15v2.13c.96.05,1.72.84,1.72,1.81s-.76,1.76-1.72,1.81v2.13c0,.43.35.77.77.77h10.53v3.42h-9.42c-3.4,0-6.16-2.76-6.16-6.15v-3.96c0-3.4,2.76-6.15,6.16-6.15h9.42v3.42h-10.53c-.43,0-.77.35-.77.77Z"
				/>
				<g class="bg-linear-to-t from-primary/10 to-primary">
					<path
						class="st3"
						d="M13.75,17.3c-.13,0-.24-.11-.24-.24v-.44c0-.13.11-.24.24-.24s.24.11.24.24v.44c0,.13-.11.24-.24.24Z"
					/>
					<path
						class="st1"
						d="M13.75,15.34c-.13,0-.24-.11-.24-.24v-.99c0-.13.11-.24.24-.24s.24.11.24.24v.99c0,.13-.11.24-.24.24ZM13.75,12.83c-.13,0-.24-.11-.24-.24v-.99c0-.13.11-.24.24-.24s.24.11.24.24v.99c0,.13-.11.24-.24.24ZM13.75,10.31c-.13,0-.24-.11-.24-.24v-.99c0-.13.11-.24.24-.24s.24.11.24.24v.99c0,.13-.11.24-.24.24Z"
					/>
					<path
						class="st0"
						d="M13.75,7.8c-.13,0-.24-.11-.24-.24v-.44c0-.13.11-.24.24-.24s.24.11.24.24v.44c0,.13-.11.24-.24.24Z"
					/>
				</g>
			</svg>
			<span class="font-semibold tracking-tight">CiteTicket</span>
		</a>

		<div class="flex min-h-0 w-full grow items-center justify-center">
			<div class="flex w-full max-w-[26rem] flex-col gap-8 px-6 py-8 sm:px-8">
				<div class="flex flex-col gap-1">
					<h1 class="text-2xl font-semibold tracking-tight text-balance">Log in to CiteTicket</h1>
					<p class="text-sm text-base-content/70">Use your assigned username and password.</p>
				</div>

				<form
					method="POST"
					action="?/login"
					use:enhance
					novalidate
					class="flex flex-col gap-2"
					aria-busy={$delayed}
				>
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Username<span class="text-error">*</span></legend>
						<label class="input w-full">
							<input
								type="text"
								name="username"
								placeholder="delacruz123"
								class="w-full"
								autocomplete="username"
								autocapitalize="none"
								spellcheck="false"
								bind:value={$form.username}
								{...$constraints.username}
								aria-invalid={$errors.username ? true : undefined}
							/>

							<UserRound class="size-4 stroke-base-content/60" />
						</label>
						<InputError>{$errors.username && $errors?.username[0]}</InputError>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Password<span class="text-error">*</span></legend>

						<label class="input w-full">
							<input
								type={show ? 'text' : 'password'}
								name="password"
								placeholder="my_secret_password"
								class="w-full"
								autocomplete="current-password"
								bind:value={$form.password}
								{...$constraints.password}
								aria-invalid={$errors.password ? true : undefined}
							/>

							<button
								type="button"
								class="flex cursor-pointer items-center rounded-sm text-base-content/60 outline-offset-4 hover:text-base-content focus-visible:outline-2 focus-visible:outline-primary"
								aria-label={show ? 'Hide password' : 'Show password'}
								aria-pressed={show}
								onclick={() => (show = !show)}
							>
								{#if show}
									<EyeClosed class="size-4" />
								{:else}
									<Eye class="size-4" />
								{/if}
							</button>
						</label>

						<InputError>{$errors.password && $errors?.password[0]}</InputError>
					</fieldset>

					<button type="submit" class="btn mt-4 w-full btn-primary" disabled={$delayed}>
						{#if $delayed}
							<LoaderCircle class="size-4 animate-spin" />
							Logging in…
						{:else}
							Log in
						{/if}
					</button>
				</form>

				{#if data.demo_accounts.length}
					<section class="flex flex-col gap-3" aria-labelledby="demo-heading">
						<div class="flex items-center gap-3 text-xs text-base-content/60">
							<span class="h-px grow bg-base-300"></span>
							<h2 id="demo-heading" class="font-medium">or explore the demo</h2>
							<span class="h-px grow bg-base-300"></span>
						</div>
						<p class="text-sm text-base-content/70">
							All data is fictional and resets nightly. Pick a role to sign in with one click.
						</p>
						<div class="grid gap-2 sm:grid-cols-2">
							{#each data.demo_accounts as account (account.key)}
								<form method="POST" action="?/demo" class="contents">
									<input type="hidden" name="account" value={account.key} />
									<button
										type="submit"
										class="flex h-full cursor-pointer flex-col items-start gap-0.5 rounded-box border border-base-300 p-3 text-left transition-colors hover:border-primary hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary"
									>
										<span class="text-sm font-semibold">{account.label}</span>
										<span class="text-xs text-base-content/60">{account.blurb}</span>
									</button>
								</form>
							{/each}
						</div>
					</section>
				{/if}
			</div>
		</div>

		<p class="px-6 pb-6 text-center text-xs text-base-content/60 lg:hidden">
			{lgu.name}
		</p>
	</main>
</div>
