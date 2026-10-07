<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms/client';
	import { KeyRound, X } from '@lucide/svelte';
	import { toast, Toaster } from 'svelte-sonner';
	import type User from '$lib/validation_schemas/Users.zod';

	let {
		superform,
		user_data
	}: {
		superform: SuperForm<User.ResetPassword, App.Superforms.Message>;
		user_data?: User.Base;
	} = $props();

	let { form, enhance, delayed, message } = superform;

	let dialog: HTMLDialogElement;

	// success is shown by the credentials dialog, so only errors need a toast here
	message.subscribe((m) => {
		if (m?.type === 'error') toast.error(m.text);
	});

	$effect(() => {
		if (user_data) {
			$form._id = user_data._id;
		}
	});
</script>

<dialog id="users_reset_password" class="modal p-2 backdrop-blur-xs" bind:this={dialog}>
	<Toaster position="top-center" richColors />

	<div class="relative modal-box flex w-full flex-col gap-4 md:w-5/12">
		<div class="flex flex-row items-center gap-4">
			<KeyRound class="size-6 stroke-warning" />

			<h3 class="font-bold text-warning">Change password?</h3>
		</div>

		<form method="POST" action="?/reset_password" use:enhance novalidate>
			<input type="hidden" name="_id" value={$form._id} />

			<div class="mb-4 flex flex-col gap-2 text-xs">
				<p>
					A new temporary password will be generated for
					<span class="font-semibold">{user_data?.firstname} {user_data?.lastname}</span>. Their
					current password will stop working immediately.
				</p>

				<p>They'll be asked to change it the next time they log in.</p>
			</div>

			<div class="modal-action mt-0">
				<button class="btn btn-ghost" type="button" onclick={() => dialog.close()}>Close</button>
				<button class="btn btn-soft btn-warning" type="submit">
					{#if $delayed}
						<span class="loading loading-xs loading-spinner"></span>
					{:else}
						Generate new password
					{/if}
				</button>

				<button
					class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm"
					type="button"
					onclick={() => dialog.close()}><X class="size-4" /></button
				>
			</div>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop h-dvh">
		<button>x</button>
	</form>
</dialog>
