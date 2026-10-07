/**
 * The demo's featured accounts. The seed script creates them and the login page's one-click
 * buttons sign in as them. The password is public on purpose: this is a throwaway demo with
 * generated data, and the demo guards stop these accounts being changed (password, archive, role).
 */
export const DEMO_PASSWORD = 'citeticket-demo';

export type DemoAccountKey = 'admin' | 'officer' | 'cashier' | 'auditor';

export type DemoAccount = {
	key: DemoAccountKey;
	username: string;
	firstname: string;
	lastname: string;
	/** shown on the login page button */
	label: string;
	blurb: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
	{
		key: 'admin',
		username: 'demo_admin',
		firstname: 'Lorna',
		lastname: 'Villanueva',
		label: 'Administrator',
		blurb: 'Users, ticket booklets, settings and incentive reports'
	},
	{
		key: 'officer',
		username: 'demo_officer',
		firstname: 'Ramon',
		lastname: 'Dela Cruz',
		label: 'Enforcement officer',
		blurb: 'Issues citations from an assigned ticket pad'
	},
	{
		key: 'cashier',
		username: 'demo_cashier',
		firstname: 'Josefina',
		lastname: 'Mendoza',
		label: 'Cashier',
		blurb: 'Looks up billings and records payments'
	},
	{
		key: 'auditor',
		username: 'demo_auditor',
		firstname: 'Teresita',
		lastname: 'Salazar',
		label: 'Auditor',
		blurb: 'Read-only access to reports, incentives and the audit log'
	}
];

export const demoUsernames = new Set(DEMO_ACCOUNTS.map((a) => a.username));

/** User types the seed creates (see scripts/seed/data.ts); the demo accounts hold these, so they are locked. */
export const DEMO_PROTECTED_USER_TYPES = [
	'Administrator',
	'Section Supervisor',
	'Enforcement Officer',
	'Cashier',
	'Auditor'
];
