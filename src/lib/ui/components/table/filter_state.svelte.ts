import { goto } from '$app/navigation';
import { page } from '$app/state';
import { issuance_status_select } from '$lib/data/static_data';
import Filter from '$lib/validation_schemas/Filter.zod';

// Shared between <Filter> (the popover form) and <FilterChips> (the removable summary under the
// header), which sit in different parts of the layout. <Filter> reports what it knows here.
export const filter_meta = $state({
	/** a <Filter> is mounted on this page; chips stay hidden elsewhere (e.g. pages with their own filters) */
	active: false,
	date_label: 'Date',
	/** id -> display name, per query param, for filters whose URL value is an opaque id */
	labels: {} as Record<string, Record<string, string>>
});

export const rememberLabels = (param: string, items: { value: unknown; label: string }[]) => {
	const known = { ...filter_meta.labels[param] };
	for (const i of items) {
		if (i.value && i.label) known[String(i.value)] = i.label;
	}
	filter_meta.labels[param] = known;
};

export type FilterChip = {
	id: string;
	name: string;
	value: string;
	/** removes this chip's value from a copy of the current params */
	remove: (p: URLSearchParams) => void;
};

const SKIPPED = new Set(['page', 'size']);

const fixed_labels: Record<string, Record<string, string>> = {
	archived: { '0': 'Any status', '-1': 'Archived only' },
	status: Object.fromEntries(issuance_status_select.map((s) => [String(s.value), s.label])),
	login: Object.fromEntries(Filter.LoginSelectItems.map((i) => [String(i.value), i.label])),
	sex: Object.fromEntries(Filter.SexSelectItems.map((i) => [String(i.value), i.label]))
};

const names: Record<string, string> = {
	search: 'Search',
	archived: 'Status',
	status: 'Ticket status',
	category: 'Category',
	login: 'Login',
	user_type: 'User type',
	enforcement_group: 'Group',
	sex: 'Sex',
	birthdate: 'Birthdate',
	barangay: 'Barangay'
};

const humanize = (key: string) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** One chip per applied value; `from`/`to` collapse into a single date-range chip. */
export const activeChips = (params: URLSearchParams): FilterChip[] => {
	const chips: FilterChip[] = [];

	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local de-dupe, never stored
	for (const key of new Set(params.keys())) {
		if (SKIPPED.has(key) || key === 'date_from' || key === 'date_to') continue;

		for (const raw of params.getAll(key)) {
			const value = raw.trim();
			if (!value) continue;
			// absent `archived` already means "active only" server-side, so 1 is the untouched default
			if (key === 'archived' && value === '1') continue;

			chips.push({
				id: `${key}=${value}`,
				name: names[key] ?? humanize(key),
				value: fixed_labels[key]?.[value] ?? filter_meta.labels[key]?.[value] ?? value,
				remove: (p) => {
					const rest = p.getAll(key).filter((v) => v !== raw);
					p.delete(key);
					for (const v of rest) p.append(key, v);
				}
			});
		}
	}

	const from = params.get('date_from')?.trim();
	const to = params.get('date_to')?.trim();
	if (from || to) {
		chips.push({
			id: 'date_range',
			name: filter_meta.date_label,
			value: from && to ? `${from} → ${to}` : from ? `from ${from}` : `until ${to}`,
			remove: (p) => {
				p.delete('date_from');
				p.delete('date_to');
			}
		});
	}

	return chips;
};

/**
 * Navigates to the current page with edited params, always back to page 1. Pass `replace` for
 * rapid-fire changes (typing) so they don't each become a history entry.
 */
export const updateParams = (edit: (p: URLSearchParams) => void, replace = false) => {
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a scratch copy handed straight to goto
	const url = new URL(page.url);
	edit(url.searchParams);
	url.searchParams.delete('page');
	// page.url already carries the base path, so resolve() would prefix it twice
	// eslint-disable-next-line svelte/no-navigation-without-resolve
	return goto(url, { replaceState: replace, keepFocus: true, noScroll: true });
};
