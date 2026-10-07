<script lang="ts">
	let { modal_close, modal_submit = () => {}, selected } = $props();
</script>

<div class="flex flex-row justify-end gap-1">
	<button class="btn btn-ghost" type="button" onclick={() => modal_close()}>Close</button>
	<button class="btn btn-primary" type="submit" onclick={() => modal_submit()}>Sign in</button>
</div>
