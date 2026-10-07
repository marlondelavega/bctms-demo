import { goto } from '$app/navigation';
import { base, resolve } from '$app/paths';
import { page } from '$app/state';
import type { SelectItems } from '$lib/types/T_select_options';
import type User from '$lib/validation_schemas/Users.zod';
import type Violator from '$lib/validation_schemas/Violators.zod';
import mongoose from 'mongoose';

export const months = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];
export const weekdays = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday'
];

export const capitalize = (str: string | undefined): string => {
	if (!str) return '';
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const get_current_route = (return_type: 'array' | 'string', page: string) => {
	const route_segments = page.split('/');
	route_segments.shift();
	return return_type === 'array' ? route_segments : route_segments.join('/');
};

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay = 300) {
	let timer: ReturnType<typeof setTimeout>;

	return (...args: Parameters<T>) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delay);
	};
}

export function updateQueryParam(params: { key: string; value: unknown }[]) {
	const url = new URL(page.url);

	params.forEach(({ key, value }) => {
		if (value === undefined || value === null || value === '') {
			url.searchParams.delete(key);
		} else {
			url.searchParams.set(key, String(value));
		}
	});

	const pathname =
		base && url.pathname.startsWith(base) ? url.pathname.slice(base.length) || '/' : url.pathname;

	goto(resolve(`${pathname}${url.search}`), {
		keepFocus: true,
		noScroll: true,
		replaceState: true
	});
}

export function parseSelectItems(
	data: Record<string, unknown>[],
	_lkey: string[] | string,
	_vkey: unknown,
	_dkey?: string
): SelectItems[] {
	if (!data.length) {
		return [
			{
				label: 'Error',
				value: 'Error'
			}
		];
	}

	return data.map((item: Record<string, unknown>) => {
		let label = '';
		if (typeof _lkey == 'string') {
			label = item[_lkey] as string;
		} else {
			label = _lkey.map((_k) => item[_k]).join(' ');
		}

		let detail: string = '';
		if (_dkey) {
			detail = _dkey.split('.').reduce((acc: Record<string, unknown>, part) => {
				return acc && (acc[part] as Record<string, unknown>);
			}, item) as unknown as string;
		}

		return {
			label: label,
			value: item[_vkey as string],
			detail: detail
		};
	});
}

export function parseSelectItemsV2(
	data: Record<string, unknown>[],
	_lkey: string[] | string,
	_vkey: unknown,
	_dkey?: string
): SelectItems[] {
	if (!data.length) {
		return [{ label: 'Error', value: 'Error' }];
	}

	const resolveNestedKey = (item: Record<string, unknown>, path: string): string => {
		return (
			(path.split('.').reduce((acc: unknown, part) => {
				return acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined;
			}, item) as string) ?? ''
		);
	};

	const resolveLabel = (item: Record<string, unknown>, lkey: string[] | string): string => {
		if (Array.isArray(lkey)) {
			return lkey.map((k) => item[k]).join(' ');
		}

		// Check if lkey is a template string (contains $ tokens)
		if (lkey.includes('$')) {
			return lkey.replace(/\$([a-zA-Z0-9_.]+)/g, (_, path) => {
				return resolveNestedKey(item, path) ?? '';
			});
		}

		// Plain string key
		return (item[lkey] as string) ?? '';
	};

	const isDateLike = (value: unknown): value is Date | string => {
		if (value instanceof Date) return true;
		if (typeof value !== 'string') return false;

		// Matches ISO 8601 date/datetime strings (e.g. "2026-07-08" or "2026-07-08T10:00:00.000Z")
		return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/.test(value);
	};

	const resolveValue = (item: Record<string, unknown>, path: string): unknown => {
		return path.split('.').reduce((acc: unknown, part) => {
			return acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined;
		}, item);
	};

	const resolveDetail = (item: Record<string, unknown>, dkey: string): string => {
		// Template string (contains $ tokens) — same pattern as resolveLabel
		if (dkey.includes('$')) {
			return dkey.replace(/\$([a-zA-Z0-9_.]+)/g, (_, path) => {
				const rawValue = resolveValue(item, path);
				return isDateLike(rawValue)
					? date.formatDate({ date: rawValue, format: 'MMM dd, yyyy' })
					: String(rawValue ?? '');
			});
		}

		// Plain string key
		const rawValue = resolveValue(item, dkey);
		return isDateLike(rawValue)
			? date.formatDate({ date: rawValue, format: 'MMM dd, yyyy' })
			: ((rawValue as string) ?? '');
	};

	return data.map((item) => ({
		label: resolveLabel(item, _lkey),
		value: item[_vkey as string],
		detail: _dkey ? resolveDetail(item, _dkey) : ''
	}));
}

/** Base url for stored photos. The demo has no file service and seeds no photos, so every row falls back to an initial. */
export function getPreviewUrl(): string {
	return '/api/files/preview/';
}

export function getNumberOrdinal(n: number): string {
	if (isNaN(n)) {
		return '';
	}

	const s = String(n);
	const lastTwoDigits = n % 100;

	//check for the numbers 11, 12, & 13
	if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
		return s + 'th';
	}

	//the rest of the numbers go here
	switch (n % 10) {
		case 1:
			//for 1, 21, 31...
			return s + 'st';
		case 2:
			//for 2, 22, 32...
			return s + 'nd';
		case 3:
			//for 3, 23, 33...
			return s + 'rd';
		default:
			//for the rest of the numbers
			return s + 'th';
	}
}

export function parseName(
	user: User.Base | Violator.Base,
	useMiddleinitial: boolean = false
): string {
	let name = '';
	if (user && user.firstname && user.lastname) {
		let middle = '';
		if (user.middlename) {
			middle = useMiddleinitial ? user.middlename[0] + '.' : user.middlename;
		}

		name = user.firstname + ' ' + middle + ' ' + user.lastname;

		if ('suffix' in user && user.suffix?.trim() !== '') {
			name += ' ' + user.suffix;
		}
	}

	return name;
}

export function formatAddress(data: Violator.Base): string {
	const line_parts = [data.address_house_number, data.address_line].filter(Boolean).join(' ');

	const parts = [
		line_parts,
		data.address_barangay,
		data.address_city,
		data.address_province
	].filter((part) => part && part.trim() !== '');

	return parts.join(', ');
}

type AddressField =
	| 'address_province'
	| 'address_city'
	| 'address_barangay'
	| 'address_line'
	| 'address_house_number';

const DEFAULT_FIELDS: AddressField[] = [
	'address_house_number',
	'address_line',
	'address_barangay',
	'address_city',
	'address_province'
];

export function parseAddress(
	{
		address_province,
		address_city,
		address_barangay,
		address_line,
		address_house_number
	}: Violator.Base,
	include: AddressField[] = DEFAULT_FIELDS
): string {
	if (!address_province && !address_city && !address_barangay) return '';

	const fieldMap: Record<AddressField, string | undefined> = {
		address_house_number,
		address_line,
		address_barangay,
		address_city,
		address_province
	};

	const parts = DEFAULT_FIELDS.filter((field) => include.includes(field))
		.map((field) => fieldMap[field])
		.filter(Boolean);

	return parts.join(', ');
}

export const number = {
	fixed(input: string | number, decimal: number) {
		if (!input || typeof input !== 'string' || typeof input !== 'number')
			throw 'input is not a number or string';
		if (input && typeof input === 'string') input = parseFloat(input);
		return parseFloat(input.toFixed(decimal));
	},
	serialize(number: string | number, length: number = 1) {
		let serialNumber = number.toString();

		const zeroes: number[] = [];

		const lessThan10 = (number: number, limit: number) =>
			`${number < limit ? '0' + number : number}`;

		for (let i = 1; i <= length; i++) zeroes.push(1 * Math.pow(10, i));

		zeroes.forEach((i) => {
			serialNumber = lessThan10(parseInt(serialNumber), i);
		});

		return serialNumber;
	},
	random(min: number, max: number) {
		return min + Math.random() * (max - min);
	}
};

export const date = {
	dateIntersection({ dateFrom, dateTo, dates }: { dateFrom: Date; dateTo: Date; dates: Date[] }) {
		return dates.filter((date) => date > dateFrom && date < dateTo);
	},
	formatDate(options: { date?: Date | string; format?: string }) {
		const _options = options || { date: null, format: null };
		let format = _options.format;
		const date = _options.date;

		if (!format) format = 'MMMM dd, yyyy (wk) hh:mm:ss aa';

		const d = !date ? new Date() : new Date(date);
		if (d.toString() === 'Invalid Date') return 'Invalid Date';

		const year = d.getFullYear().toString();
		const month = (d.getMonth() + 1).toString();
		const monthName = months[d.getMonth()];
		const day = d.getDate().toString();
		const weekday = weekdays[d.getDay()];
		const hours24 = d.getHours().toString();
		const hours = (d.getHours() % 12 || 12).toString();
		const minutes = d.getMinutes().toString();
		const seconds = d.getSeconds().toString();
		const ampm = d.getHours() >= 12 ? 'PM' : 'AM';

		const map: { [key: string]: unknown } = {
			MMMM: monthName, // "January" full month
			MMM: monthName.substring(0, 3), // "Jan" 3 letter month
			MM: number.serialize(month), // "01" serialize month
			M1: month, // "1" month
			yyyy: year, // "2022" full year
			yy: year.substring(2), // "22" 2 digit year
			dd: number.serialize(day), // "04" serialize day
			d: day, // "4" day
			wkf: weekday, // "Thursday"
			wk: weekday.substring(0, 3), // "Thu"
			h4: number.serialize(hours24), // "22" 24 hour format
			hh: number.serialize(hours), // "09" hours
			mm: number.serialize(minutes), // "03" minutes
			ss: number.serialize(seconds), // "01" seconds
			aa: ampm // "AM" or "PM"
		};

		Object.keys(map).forEach((key: string) => {
			while (format?.includes(key)) format = format.replace(key, map[key] as string);
		});

		return format;
	},
	relativeDate(date: Date, referenceDate: Date = new Date()) {
		const units: Record<string, number> = {
			year: 24 * 60 * 60 * 1000 * 365,
			month: (24 * 60 * 60 * 1000 * 365) / 12,
			day: 24 * 60 * 60 * 1000,
			hour: 60 * 60 * 1000,
			minute: 60 * 1000,
			second: 1000
		};

		const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

		const elapsed = date.getTime() - referenceDate.getTime();

		for (const u in units) {
			if (Math.abs(elapsed / units[u]) < 1) continue;
			return rtf.format(Math.round(elapsed / units[u]), u as Intl.RelativeTimeFormatUnit);
		}
	},
	dateToString(params_date?: Date) {
		const date = params_date ?? new Date();
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
		const day = String(date.getDate()).padStart(2, '0');

		const formatted = `${year}-${month}-${day}`;
		return formatted;
	},
	formatTime(_t: string) {
		const _time = new Date(_t);
		const hours = _time.getHours();
		const minutes = _time.getMinutes();
		const period = hours >= 12 ? 'PM' : 'AM';
		const hours12 = hours % 12 || 12;
		const final = `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
		return final;
	},
	formatTimev2(_t: string) {
		const [h, m] = _t.split(':').map(Number);
		const period = h >= 12 ? 'PM' : 'AM';
		const hours12 = h % 12 || 12;
		const final = `${hours12}:${String(m).padStart(2, '0')} ${period}`;
		return final;
	}
};

type PermissionLevel = 'own' | 'all' | 'office' | 'none';

type PermissionActions = {
	[key: string]: PermissionLevel;
};

export const permissions = {
	get: (route: string, permissions: string[] | undefined): PermissionActions => {
		return new Proxy({} as PermissionActions, {
			get: (target, action: string) => {
				// Fail closed: no permissions array, or no matching entry for this
				// action/route, both mean "not allowed" — never leave this ambiguous
				// as undefined/null, which callers checking `!== 'none'` would treat
				// as allowed.
				if (!permissions) {
					return 'none';
				}

				// Find matching permission for this action and route
				const matching = permissions.find((p) => {
					const parts = p.split(':');
					return parts[0] === action && parts[2] === route;
				});

				return (matching?.split(':')[1] as PermissionLevel) ?? 'none';
			}
		});
	},
	hasAccess: (route: string, permissions: string[] | undefined): boolean => {
		if (!permissions) return false;
		return permissions.some((p) => {
			const parts = p.split(':');
			return parts[2] === route && parts[1] !== 'none';
		});
	}
};

export const toObjectId = (value: string | null | undefined): mongoose.Types.ObjectId | null => {
	if (!value || value.trim() === '') return null;
	try {
		return new mongoose.Types.ObjectId(value);
	} catch (error) {
		if (error) return null;
		return null;
	}
};

export const parseNumber = (value: string | null, fallback: number): number => {
	const n = Number(value);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export function parsePagination(url: URL): { skip: number; limit: number } {
	const limit: number = url.searchParams.get('size') ? Number(url.searchParams.get('size')) : 10;
	let skip: number = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : 1;
	skip = (skip - 1) * limit;

	return { skip, limit };
}

export const parseSearchParams = (
	params: URLSearchParams
): { skip: number; limit: number; search: string; archived: number } => {
	const limit = parseNumber(params.get('size'), 10);
	const page = parseNumber(params.get('page'), 1);
	const skip = (page - 1) * limit;

	const search = (params.get('search')?.trim() ?? '').toString();
	const archived = params.get('archived') !== null ? Number(params.get('archived')) : 1;

	return { skip, limit, search, archived };
};

export const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every non-empty, de-duplicated value of a repeatable filter (`?category=A&category=B`). */
export const multiParam = (params: URLSearchParams, key: string): string[] => [
	...new Set(
		params
			.getAll(key)
			.map((v) => v.trim())
			.filter(Boolean)
	)
];

/** `?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` as an inclusive Mongo range, or null if neither is set/valid. */
export const parseDateRange = (params: URLSearchParams): { $gte?: Date; $lte?: Date } | null => {
	const from = new Date(`${params.get('date_from') ?? ''}T00:00:00`);
	const to = new Date(`${params.get('date_to') ?? ''}T23:59:59.999`);
	const range: { $gte?: Date; $lte?: Date } = {};
	if (!isNaN(from.getTime())) range.$gte = from;
	if (!isNaN(to.getTime())) range.$lte = to;
	return Object.keys(range).length ? range : null;
};

export function calculateAge(birthdate: Date | string, referenceDate: Date = new Date()): number {
	const birth = birthdate instanceof Date ? birthdate : new Date(birthdate);

	if (isNaN(birth.getTime())) {
		throw new Error('Invalid birthdate provided.');
	}

	let age = referenceDate.getFullYear() - birth.getFullYear();

	const hasHadBirthdayThisYear =
		referenceDate.getMonth() > birth.getMonth() ||
		(referenceDate.getMonth() === birth.getMonth() && referenceDate.getDate() >= birth.getDate());

	if (!hasHadBirthdayThisYear) {
		age--;
	}

	return age;
}
