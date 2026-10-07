import type Incentive from '$lib/validation_schemas/Incentives.zod';

/**
 * Incentive math, shared by the generate preview (browser) and report generation (server) so the
 * totals someone approves on screen are exactly the totals that get saved.
 */

/** Rounds to centavos. Each ticket's line is rounded on its own, then the rounded lines are summed. */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** One ticket's incentive: a percentage of its base amount, or the fixed amount per ticket. */
export function incentiveFor(base_amount: number, rate: Incentive.Rate): number {
	if (rate.rate_type === 'fixed') return round2(rate.amount);
	return round2((base_amount * rate.amount) / 100);
}

/** Describes a rate for display: "5% of paid amount" / "₱50.00 per ticket". */
export function describeRate(rate: Incentive.Rate, peso: Intl.NumberFormat): string {
	if (rate.rate_type === 'fixed') return `${peso.format(rate.amount)} per ticket`;
	return `${rate.amount}% of ${rate.basis === 'paid' ? 'amount paid' : 'fine total'}`;
}

export const basisLabel = (basis: Incentive.Basis) =>
	basis === 'paid' ? 'Paid tickets' : 'Issued tickets';

export function sameRate(a: Incentive.Rate | null, b: Incentive.Rate): boolean {
	return !!a && a.rate_type === b.rate_type && a.amount === b.amount && a.basis === b.basis;
}

type People = Record<string, { name: string; user_type: string }>;
type Groups = Record<string, { name: string; basis: Incentive.Basis }>;

const emptyTotals = (): Incentive.Totals => ({
	ticket_count: 0,
	base_amount: 0,
	incentive_amount: 0
});

function add(into: Incentive.Totals, line: Incentive.Line) {
	into.ticket_count += 1;
	into.base_amount = round2(into.base_amount + line.base_amount);
	into.incentive_amount = round2(into.incentive_amount + line.incentive_amount);
}

/** Per-group and per-officer subtotals plus the grand total, from a list of ticket lines. */
export function summarize(lines: Incentive.Line[], people: People, groups: Groups) {
	const by_group = new Map<string, Incentive.GroupSummary>();
	const by_recipient = new Map<string, Incentive.RecipientSummary>();
	const totals = { ...emptyTotals(), recipient_count: 0 };

	for (const line of lines) {
		let g = by_group.get(line.group);
		if (!g) {
			g = {
				group: line.group,
				name: groups[line.group]?.name ?? 'Unknown group',
				basis: groups[line.group]?.basis ?? line.basis,
				...emptyTotals()
			};
			by_group.set(line.group, g);
		}
		add(g, line);

		// an officer who moved offices gets one row per group their tickets fall under
		const key = `${line.group}:${line.issuer}`;
		let r = by_recipient.get(key);
		if (!r) {
			r = {
				user: line.issuer,
				name: people[line.issuer]?.name || 'Unknown user',
				user_type: people[line.issuer]?.user_type ?? '',
				group: line.group,
				...emptyTotals()
			};
			by_recipient.set(key, r);
		}
		add(r, line);
		add(totals, line);
	}

	totals.recipient_count = new Set(lines.map((l) => l.issuer)).size;

	const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
	const group_order = [...by_group.values()].sort(byName);
	const rank = new Map(group_order.map((g, i) => [g.group, i]));

	return {
		by_group: group_order,
		by_recipient: [...by_recipient.values()].sort(
			(a, b) => (rank.get(a.group) ?? 0) - (rank.get(b.group) ?? 0) || byName(a, b)
		),
		totals
	};
}

/** Recomputes totals from already-summarized rows — used when a viewer only sees part of a report. */
export function totalsOf(rows: Incentive.RecipientSummary[]) {
	const totals = { ...emptyTotals(), recipient_count: new Set(rows.map((r) => r.user)).size };
	for (const r of rows) {
		totals.ticket_count += r.ticket_count;
		totals.base_amount = round2(totals.base_amount + r.base_amount);
		totals.incentive_amount = round2(totals.incentive_amount + r.incentive_amount);
	}
	return totals;
}
