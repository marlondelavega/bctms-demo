// export enum issuance_status {
// 	ISSUED = 0,
// 	DAMAGED = 1,
// 	CANCELLED = 2,
// 	'NOTICE OF SETTLEMENT' = 3,
// 	PAID = 4,
// 	'FORWARDED TO CLO' = 5,
// 	'RECEIVED IN CLO' = 6,
// 	'FILED CASE' = 7,
// 	'CASE CLOSED' = 8
// }
//

export enum issuance_status {
	ISSUED = 1,
	'NOTICE OF SETTLEMENT' = 2,
	PAID = 3,
	'FILED CASE' = 4,
	'CASE CLOSED' = 5,
	CANCELLED = 6
}

export const issuance_status_select = [
	{ label: 'Issued', value: 1 },
	{ label: 'Notice of Settlement', value: 2 },
	{ label: 'Paid', value: 3 },
	{ label: 'Filed Case', value: 4 },
	{ label: 'Case Closed', value: 5 },
	{ label: 'Cancelled', value: 6 }
];

export const issuance_status_data = [
	{
		label: 'Issued',
		value: 1,
		color: 'info',
		badge_color: 'badge-info',
		text_color: 'text-info',
		dot_color: 'bg-info'
	},
	{
		label: 'Notice of Settlement',
		value: 2,
		color: 'warning',
		badge_color: 'badge-warning',
		text_color: 'text-warning',
		dot_color: 'bg-warning'
	},
	{
		label: 'Paid',
		value: 3,
		color: 'success',
		badge_color: 'badge-success',
		text_color: 'text-success',
		dot_color: 'bg-success'
	},
	{
		label: 'Filed Case',
		value: 4,
		color: 'info',
		badge_color: 'badge-info',
		text_color: 'text-info',
		dot_color: 'bg-info'
	},
	{
		label: 'Case Closed',
		value: 5,
		color: 'success',
		badge_color: 'badge-success',
		text_color: 'text-success',
		dot_color: 'bg-success'
	},
	{
		label: 'Cancelled',
		value: 6,
		color: 'error',
		badge_color: 'badge-error',
		text_color: 'text-error',
		dot_color: 'bg-error'
	}
];

// Solid fill per status for bars and legend dots. Filed Case / Case Closed share a hue with
// Issued / Paid in issuance_status_data, so they are tinted lighter to stay distinguishable.
export const issuance_status_swatch: Record<number, string> = {
	1: 'bg-info',
	2: 'bg-warning',
	3: 'bg-success',
	4: 'bg-info/50',
	5: 'bg-success/50',
	6: 'bg-error'
};

// Manual transitions a staff member can pick from the "Change status to" dropdown. Notice of
// Settlement is deliberately absent as a *target* anywhere here — it's only ever set by the
// automated overdue scan (Issuances.service.ts#flagOverdueIssuances), never chosen by a person.
export const issuance_status_transitions: Record<number, issuance_status[]> = {
	[issuance_status.ISSUED]: [
		issuance_status.PAID,
		issuance_status['FILED CASE'],
		issuance_status.CANCELLED
	],
	[issuance_status['NOTICE OF SETTLEMENT']]: [
		issuance_status.PAID,
		issuance_status['FILED CASE'],
		issuance_status.CANCELLED
	],
	[issuance_status['FILED CASE']]: [issuance_status['CASE CLOSED'], issuance_status.CANCELLED],
	[issuance_status['CASE CLOSED']]: [issuance_status.CANCELLED],
	[issuance_status.PAID]: [],
	[issuance_status.CANCELLED]: []
};

export function getAllowedIssuanceStatusTransitions(current: number): issuance_status[] {
	return issuance_status_transitions[current] ?? [];
}

export const issuance_form_step = ['Violator', 'Ticket', 'Violations', 'Apprehension', 'Confirm'];

/** Barangays of the fictional City of Dalisay, bundled so the issuance form needs no outside API */
export const city_barangays = [
	'Aguinaldo',
	'Bagong Silang',
	'Burgos',
	'Del Pilar',
	'Luna',
	'Mabini',
	'Magsaysay',
	'Poblacion',
	'Quezon',
	'Rizal',
	'San Isidro',
	'Santa Rosa'
];
