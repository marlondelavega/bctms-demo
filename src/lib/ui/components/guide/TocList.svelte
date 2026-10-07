<script lang="ts">
	export type TocEntry = { id: string; title: string; children: { id: string; title: string }[] };

	type Props = {
		toc: TocEntry[];
		active: string;
		onnavigate?: () => void;
	};

	let { toc, active, onnavigate }: Props = $props();

	// a section counts as current while any of its topics is
	const activeSection = $derived(
		toc.find((s) => s.id === active || s.children.some((c) => c.id === active))?.id
	);
</script>

<nav aria-label="On this page">
	<ul class="flex flex-col gap-0.5 text-sm">
		{#each toc as section (section.id)}
			<li>
				<a
					href={`#${section.id}`}
					onclick={onnavigate}
					aria-current={active === section.id ? 'location' : undefined}
					class={[
						'block rounded-field px-2 py-1.5 transition-colors hover:bg-base-300/60',
						activeSection === section.id ? 'font-semibold text-primary' : 'font-medium'
					]}
				>
					{section.title}
				</a>

				{#if activeSection === section.id && section.children.length}
					<ul class="mt-0.5 mb-1.5 ml-2 flex flex-col border-l border-base-300 pl-2">
						{#each section.children as topic (topic.id)}
							<li>
								<a
									href={`#${topic.id}`}
									onclick={onnavigate}
									aria-current={active === topic.id ? 'location' : undefined}
									class={[
										'block rounded-field px-2 py-1 text-[13px] transition-colors hover:bg-base-300/60',
										active === topic.id ? 'font-medium text-primary' : 'text-base-content/70'
									]}
								>
									{topic.title}
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
</nav>
