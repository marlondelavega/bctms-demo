<script lang="ts">
	type Props = {
		/** What the screenshot shows, used as the caption and as alt text. */
		caption: string;
		/** File name inside src/lib/assets/guide. Nothing is shown while the file is missing. */
		file: string;
	};

	let { caption, file }: Props = $props();

	const images = import.meta.glob<string>('$lib/assets/guide/*.{png,jpg,jpeg,webp}', {
		eager: true,
		query: '?url',
		import: 'default'
	});

	const src = $derived(
		Object.entries(images).find(([path]) => path.endsWith(`/${file}`))?.[1] as string | undefined
	);
</script>

{#if src}
	<figure class="not-prose my-6">
		<img
			{src}
			alt={caption}
			width="1920"
			height="1080"
			loading="lazy"
			decoding="async"
			class="aspect-video w-full rounded-box border border-base-300 bg-base-200"
		/>
		<figcaption class="mt-2 text-xs text-base-content/65">{caption}</figcaption>
	</figure>
{/if}
