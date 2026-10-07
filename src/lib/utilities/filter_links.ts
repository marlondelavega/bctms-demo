/** Helpers for report links that add, drop or toggle a single filter value in the current URL. */

const clone = (url: URL) => new URLSearchParams(url.searchParams);

const href = (url: URL, params: URLSearchParams) => {
	const qs = params.toString();
	return qs ? `${url.pathname}?${qs}` : url.pathname;
};

/** URL without one value of a repeatable filter, or without the whole key when `value` is omitted. */
export function hrefWithout(url: URL, key: string, value?: string) {
	const params = clone(url);
	const keep = value === undefined ? [] : params.getAll(key).filter((v) => v !== value);
	params.delete(key);
	keep.forEach((v) => params.append(key, v));
	// a narrower result set may have fewer pages than the current one
	if (params.has('page')) params.set('page', '1');
	return href(url, params);
}

/** URL with `value` added to a repeatable filter, or removed if it is already there. */
export function hrefToggle(url: URL, key: string, value: string) {
	const params = clone(url);
	const current = params.getAll(key);
	return current.includes(value)
		? hrefWithout(url, key, value)
		: (params.append(key, value), href(url, params));
}

/** "Status: Paid, Issued · Group: Traffic" — the applied filters as one printable line. */
export function summarizeChips(chips: { group: string; text: string }[]) {
	const by_group: Record<string, string[]> = {};
	for (const c of chips) (by_group[c.group] ??= []).push(c.text);
	return Object.entries(by_group)
		.map(([group, items]) => `${group}: ${items.join(', ')}`)
		.join(' · ');
}
