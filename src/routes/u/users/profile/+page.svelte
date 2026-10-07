<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { date, getPreviewUrl, parseName } from '$lib/utilities/helper';
	import { KeyRound, LogOut, Monitor, Smartphone, Tablet } from '@lucide/svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';

	const { data } = $props();

	const user = $derived(data.user);
	const account = $derived(data.account);
	const sessions = $derived(data.sessions);

	const role = $derived(user.user_type?.user_type ?? '');
	const office = $derived(user.enforcement_group?.name ?? '');
	const initials = $derived(`${user.firstname?.[0] ?? ''}${user.lastname?.[0] ?? ''}`);

	let photo_failed = $state(false);

	const other_sessions = $derived(sessions.filter((s) => s._id !== data.current_session_id));

	const fullDate = (d: Date | string | null) =>
		d ? new Date(d).toLocaleDateString('en-PH', { dateStyle: 'long' }) : '—';

	const dateTime = (d: Date | string) =>
		new Date(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

	const ago = (d: Date | string | null) =>
		d ? (date.relativeDate(new Date(d)) ?? 'just now') : '';

	const row = 'grid grid-cols-1 gap-0.5 px-3 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-3';
	const term = 'text-base-content/60';

	const device_icon = { desktop: Monitor, mobile: Smartphone, tablet: Tablet };

	const deviceName = (device: { browser: string; os: string }) => {
		const browser = device.browser !== 'Unknown' ? device.browser : 'Unknown browser';
		return device.os !== 'Unknown' ? `${browser} on ${device.os}` : browser;
	};

	// which form is mid-submit: a session id, or 'others'
	let pending = $state<string | null>(null);

	const submit =
		(key: string): SubmitFunction =>
		() => {
			pending = key;
			return async ({ result, update }) => {
				pending = null;
				if (result.type === 'success' && result.data?.success) {
					toast.success(String(result.data.success));
				} else if (result.type === 'failure' && result.data?.error) {
					toast.error(String(result.data.error));
				} else if (result.type === 'error') {
					toast.error('Could not sign out that device. Please try again.');
				}
				await update();
			};
		};
</script>

<div class="flex max-w-3xl flex-col gap-8">
	<!-- identity -->
	<section class="flex flex-row items-center gap-4" aria-labelledby="profile-name">
		<div
			class="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xl font-semibold text-primary-content ring-1 ring-base-300 md:size-20 md:text-2xl"
		>
			{#if user.profile_image && !photo_failed}
				<img
					src={getPreviewUrl() + user.profile_image}
					alt=""
					class="size-full object-cover"
					onerror={() => (photo_failed = true)}
				/>
			{:else}
				<span aria-hidden="true">{initials}</span>
			{/if}
		</div>

		<div class="flex min-w-0 flex-col gap-1">
			<h2 id="profile-name" class="text-lg leading-tight font-semibold text-balance md:text-xl">
				{parseName(user)}
			</h2>
			<p class="truncate text-sm text-base-content/60">@{user.username}</p>
			{#if role || office}
				<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
					{#if role}<span class="badge badge-soft badge-sm badge-primary">{role}</span>{/if}
					{#if office}<span class="text-base-content/70">{office}</span>{/if}
				</p>
			{/if}
		</div>
	</section>

	<!-- account -->
	<section class="flex flex-col gap-3" aria-labelledby="account-heading">
		<div>
			<h3 id="account-heading" class="text-sm font-semibold">Account</h3>
			<p class="text-xs text-base-content/60">
				Your name, role and office are managed by an administrator. Ask them if anything here is
				wrong.
			</p>
		</div>

		<dl class="divide-y divide-base-300 rounded-field border border-base-300 text-sm">
			<div class={row}>
				<dt class={term}>Full name</dt>
				<dd>{parseName(user)}</dd>
			</div>
			<div class={row}>
				<dt class={term}>Username</dt>
				<dd class="font-mono">{user.username}</dd>
			</div>
			<div class={row}>
				<dt class={term}>User type</dt>
				<dd>{role || '—'}</dd>
			</div>
			<div class={row}>
				<dt class={term}>Office</dt>
				<dd>{office || '—'}</dd>
			</div>
			<div class={row}>
				<dt class={term}>Account created</dt>
				<dd>
					{fullDate(account.created_at)}
					{#if account.created_by}
						<span class="text-base-content/60">by {account.created_by}</span>
					{/if}
				</dd>
			</div>
			<div class={[row, 'sm:items-center']}>
				<dt class={term}>Password</dt>
				<dd class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
					<span>
						Last changed {fullDate(account.last_password_change_date)}
						{#if account.last_password_change_date}
							<span class="text-base-content/60">({ago(account.last_password_change_date)})</span>
						{/if}
					</span>
					<a href={resolve('/u/users/profile/change-password')} class="btn btn-ghost btn-xs">
						<KeyRound class="size-3.5" />
						Change password
					</a>
				</dd>
			</div>
		</dl>
	</section>

	<!-- sessions -->
	<section class="flex flex-col gap-3" aria-labelledby="sessions-heading">
		<div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
			<div class="min-w-0">
				<h3 id="sessions-heading" class="text-sm font-semibold">Signed-in devices</h3>
				<p class="text-xs text-base-content/60">
					Up to 3 devices can stay signed in. A device is signed out after 4 hours without activity,
					and every sign-in ends after a day.
				</p>
			</div>

			{#if other_sessions.length}
				<form method="POST" action="?/sign_out_others" use:enhance={submit('others')}>
					<button class="btn btn-outline btn-sm btn-error" disabled={pending !== null}>
						{#if pending === 'others'}
							<span class="loading loading-xs loading-spinner"></span>
						{:else}
							<LogOut class="size-3.5" />
						{/if}
						Sign out other devices
					</button>
				</form>
			{/if}
		</div>

		<ul class="divide-y divide-base-300 rounded-field border border-base-300">
			{#each sessions as session (session._id)}
				{@const Icon = device_icon[session.device?.kind] ?? Monitor}
				{@const is_current = session._id === data.current_session_id}
				<li class="flex flex-row items-center gap-3 px-3 py-3">
					<span
						class={[
							'grid size-9 shrink-0 place-items-center rounded-full',
							is_current ? 'bg-primary/10 text-primary' : 'bg-base-200 text-base-content/60'
						]}
					>
						<Icon class="size-4" />
					</span>

					<div class="flex min-w-0 grow flex-col gap-0.5">
						<p class="flex flex-wrap items-center gap-x-2 text-sm font-medium">
							{deviceName(session.device)}
							{#if is_current}
								<span class="badge badge-soft badge-xs badge-primary">This device</span>
							{/if}
						</p>
						<p class="text-xs text-base-content/60">
							Signed in {dateTime(session.created_at)} ·
							{is_current ? 'Active now' : `Last active ${ago(session.last_seen_at)}`}
						</p>
						{#if session.ip}
							<p class="text-xs text-base-content/45">
								<span class="font-mono tabular-nums">{session.ip}</span> (approximate)
							</p>
						{/if}
					</div>

					{#if !is_current}
						<form
							method="POST"
							action="?/sign_out_session"
							use:enhance={submit(session._id)}
							class="shrink-0"
						>
							<input type="hidden" name="session_id" value={session._id} />
							<button
								class="btn btn-ghost btn-sm text-error"
								disabled={pending !== null}
								aria-label={`Sign out ${deviceName(session.device)}`}
							>
								{#if pending === session._id}
									<span class="loading loading-xs loading-spinner"></span>
								{/if}
								Sign out
							</button>
						</form>
					{/if}
				</li>
			{:else}
				<li class="px-3 py-4 text-sm text-base-content/60">No devices are signed in.</li>
			{/each}
		</ul>
	</section>
</div>
