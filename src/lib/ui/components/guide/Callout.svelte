<script lang="ts">
	import { Info, Lightbulb, TriangleAlert } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		kind?: 'note' | 'important' | 'tip';
		label?: string;
		children: Snippet;
	};

	let { kind = 'note', label, children }: Props = $props();

	const tone = {
		note: { box: 'bg-info/10', icon: 'text-info', label: 'Note', Icon: Info },
		important: {
			box: 'bg-warning/15',
			icon: 'text-warning',
			label: 'Important',
			Icon: TriangleAlert
		},
		tip: { box: 'bg-success/10', icon: 'text-success', label: 'Tip', Icon: Lightbulb }
	} as const;

	const t = $derived(tone[kind]);
</script>

<aside class={['not-prose my-6 flex gap-3 rounded-box p-4 text-sm leading-6', t.box]}>
	<t.Icon class={['mt-0.5 size-4 shrink-0', t.icon]} aria-hidden="true" />
	<div class="min-w-0">
		<strong class="font-semibold">{label ?? t.label}:</strong>
		{@render children()}
	</div>
</aside>
