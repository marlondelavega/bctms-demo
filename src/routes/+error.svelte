<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

{#if page.status == 404}
	<div class="flex h-screen flex-row items-center gap-16 px-16" style="justify-content: center;">
		<div class="error-status p-0 px-0!">
			<p class="font-semibold">{page.status}</p>
		</div>

		<div>
			<div class="error-message">
				<p>Page {page.error?.message}</p>
			</div>
			<div class="mt-4 flex flex-col gap-3">
				<p class="text-sm">There are 2 reasons why you are here:</p>
				<ul class="list-disc text-sm">
					<li>the link you entered is incorrectly typed or broken; or</li>
					<li>the page is under construction or already deprecated.</li>
				</ul>
				<p class="text-sm"><a class="underline" href={resolve('/')}>Click here</a> to go back.</p>
			</div>
		</div>
	</div>
{:else}
	<div class="flex h-screen flex-row items-center gap-16 px-16" style="justify-content: center;">
		<div class="error-status p-0 px-0!">
			<p class="font-semibold">{page.status}</p>
		</div>

		<div>
			<div class="error-message">
				<p>{page.error?.message}</p>
			</div>
		</div>
	</div>
{/if}

<style>
	.error-status {
		padding-inline: 1rem;
		line-height: 4rem;
	}
	.error-status p {
		font-size: 4rem;
		font-weight: bold;
	}
	.error-message {
		line-height: 1.2rem;
		font-size: 1.2rem;
	}
</style>
