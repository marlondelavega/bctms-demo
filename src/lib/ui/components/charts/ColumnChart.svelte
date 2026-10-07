<script lang="ts">
	type Point = { date: string; value: number };

	type Props = {
		data: Point[];
		label: string;
		format?: (value: number) => string;
		formatTick?: (value: number) => string;
		barClass?: string;
		height?: number;
		emptyText?: string;
	};

	let {
		data,
		label,
		format = (v) => v.toLocaleString('en-PH'),
		formatTick = format,
		barClass = 'fill-primary',
		height = 180,
		emptyText = 'No activity in this period.'
	}: Props = $props();

	const isEmpty = $derived(data.every((d) => d.value === 0));

	const pad = { top: 8, right: 4, bottom: 22, left: 48 };
	const plotH = $derived(height - pad.top - pad.bottom);

	let width = $state(0);
	let hovered = $state<number | null>(null);

	function niceMax(v: number) {
		if (v <= 0) return 1;
		const exp = Math.pow(10, Math.floor(Math.log10(v)));
		const f = v / exp;
		return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
	}

	const max = $derived(niceMax(Math.max(0, ...data.map((d) => d.value))));
	const ticks = $derived(Number.isInteger(max / 2) ? [0, max / 2, max] : [0, max]);
	const plotW = $derived(Math.max(0, width - pad.left - pad.right));
	const slot = $derived(data.length ? plotW / data.length : 0);
	const barW = $derived(Math.max(2, Math.min(24, slot - 2)));
	const baseline = $derived(pad.top + plotH);

	const yOf = (v: number) => pad.top + plotH - (v / max) * plotH;
	const xOf = (i: number) => pad.left + i * slot + (slot - barW) / 2;

	// rounded data-end, square at the baseline
	function barPath(i: number, v: number) {
		const h = baseline - yOf(v);
		if (h <= 0) return '';
		const x = xOf(i);
		const y = baseline - h;
		const r = Math.min(4, barW / 2, h);
		return `M${x},${baseline}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + barW - r}A${r},${r} 0 0 1 ${x + barW},${y + r}V${baseline}Z`;
	}

	const formatDay = (date: string) =>
		new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

	// label roughly weekly, always including the most recent day
	const showLabel = (i: number) => (data.length - 1 - i) % 7 === 0;

	const tooltipLeft = $derived(
		hovered === null ? 0 : Math.min(Math.max(xOf(hovered) + barW / 2, 60), width - 60)
	);
</script>

<div class="relative w-full" bind:clientWidth={width}>
	{#if isEmpty}
		<div
			class="flex items-center justify-center rounded-field border border-dashed border-base-300 text-xs text-base-content/50"
			style:height="{height}px"
		>
			{emptyText}
		</div>
	{:else if width > 0}
		<svg {width} {height} role="img" aria-label={label} class="block">
			{#each ticks as t (t)}
				<line
					x1={pad.left}
					x2={width - pad.right}
					y1={yOf(t)}
					y2={yOf(t)}
					class="stroke-base-content/10"
					stroke-width="1"
				/>
				<text
					x={pad.left - 8}
					y={yOf(t)}
					dy="0.32em"
					text-anchor="end"
					class="fill-base-content/50 text-[10px] tabular-nums"
				>
					{formatTick(t)}
				</text>
			{/each}

			{#each data as d, i (d.date)}
				<path
					d={barPath(i, d.value)}
					class={[barClass, 'transition-opacity']}
					opacity={hovered === null || hovered === i ? 1 : 0.45}
				/>
				{#if showLabel(i)}
					<text
						x={pad.left + i * slot + slot / 2}
						y={height - 6}
						text-anchor="middle"
						class="fill-base-content/50 text-[10px]"
					>
						{formatDay(d.date)}
					</text>
				{/if}
			{/each}

			<!-- hit targets span the whole slot so thin columns stay easy to hover -->
			{#each data as d, i (d.date)}
				<rect
					role="presentation"
					x={pad.left + i * slot}
					y={pad.top}
					width={slot}
					height={plotH}
					fill="transparent"
					onmouseenter={() => (hovered = i)}
					onmouseleave={() => (hovered = null)}
				/>
			{/each}
		</svg>

		{#if hovered !== null}
			<div
				class="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-field border border-base-300 bg-base-100 px-2 py-1 text-xs whitespace-nowrap shadow-sm"
				style:left="{tooltipLeft}px"
			>
				<div class="text-base-content/60">{formatDay(data[hovered].date)}</div>
				<div class="font-semibold">{format(data[hovered].value)}</div>
			</div>
		{/if}
	{:else}
		<div style:height="{height}px"></div>
	{/if}

	{#if !isEmpty}
		<table class="sr-only">
			<caption>{label}</caption>
			<tbody>
				{#each data as d (d.date)}
					<tr>
						<th scope="row">{formatDay(d.date)}</th>
						<td>{format(d.value)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
