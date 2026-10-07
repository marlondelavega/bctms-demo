/** Static content for the demo seed: offices, roles, ordinance provisions and name pools. All fictional. */
import { dev_permissions } from '$lib/server/models/UserTypes.model';

export const GROUPS = [
	{
		key: 'admin',
		name: 'City Administration',
		description: 'City administrator’s office: users, ticket booklets and system settings.'
	},
	{
		key: 'treasury',
		name: 'City Treasury',
		description: 'Collects fines and records payments for citation tickets.'
	},
	{
		key: 'traffic',
		name: 'Traffic Management',
		description: 'Enforces traffic, parking and public utility vehicle regulations.',
		incentive: { rate_type: 'percentage', amount: 10, basis: 'issued' }
	},
	{
		key: 'environment',
		name: 'Environment and Natural Resources',
		description: 'Enforces solid waste, pollution and land protection ordinances.',
		incentive: { rate_type: 'fixed', amount: 50, basis: 'paid' }
	},
	{
		key: 'order',
		name: 'Public Order and Safety',
		description: 'Enforces public conduct, noise and sidewalk obstruction ordinances.',
		incentive: { rate_type: 'percentage', amount: 8, basis: 'paid' }
	}
] as const;

export type GroupKey = (typeof GROUPS)[number]['key'];

const view = (resources: string[], scope = 'all') => resources.map((r) => `access:${scope}:${r}`);

export const USER_TYPES = [
	{
		key: 'admin',
		user_type: 'Administrator',
		role: 'System administrator',
		access_level: 1,
		permissions: [...dev_permissions]
	},
	{
		key: 'supervisor',
		user_type: 'Section Supervisor',
		role: 'Office in-charge',
		access_level: 3,
		permissions: [
			...view(
				[
					'users',
					'tickets',
					'ticket_assignments',
					'ticket_liquidation',
					'issuance',
					'billing',
					'payments',
					'reports',
					'logs',
					'incentives'
				],
				'office'
			),
			...view(['violators', 'code_provisions', 'violation_categories', 'enforcement_groups']),
			'create:office:ticket_assignments',
			'edit:office:ticket_assignments',
			'edit:office:issuance',
			'edit:office:tickets',
			'edit:office:ticket_liquidation',
			'create:office:violators',
			'edit:all:violators',
			'create:office:incentives',
			'archive:office:incentives'
		]
	},
	{
		key: 'officer',
		user_type: 'Enforcement Officer',
		role: 'Field officer',
		access_level: 5,
		permissions: [
			...view(['issuance', 'ticket_assignments', 'billing', 'payments', 'incentives'], 'own'),
			...view(['violators', 'code_provisions', 'violation_categories']),
			'create:own:issuance',
			'edit:own:issuance',
			'create:all:violators',
			'edit:all:violators'
		]
	},
	{
		key: 'cashier',
		user_type: 'Cashier',
		role: 'Treasury staff',
		access_level: 4,
		permissions: [
			...view(['issuance', 'billing', 'payments', 'violators', 'reports', 'logs'], 'all'),
			'create:all:payments',
			'edit:all:payments'
		]
	},
	{
		key: 'auditor',
		user_type: 'Auditor',
		role: 'Auditor / management',
		access_level: 2,
		permissions: view([
			'users',
			'tickets',
			'violators',
			'user_types',
			'enforcement_groups',
			'violation_categories',
			'code_provisions',
			'issuance',
			'ticket_assignments',
			'ticket_liquidation',
			'billing',
			'payments',
			'reports',
			'logs',
			'incentives'
		])
	}
] as const;

export type UserTypeKey = (typeof USER_TYPES)[number]['key'];

type Offense = {
	pecuniary: number;
	disciplinary?: string;
	surcharge?: { type: 'fixed' | 'percentage'; value: number; days: number; every: number };
};

export type CategorySeed = {
	name: string;
	description: string;
	group: GroupKey;
	subs: string[];
	provisions: {
		sub: number;
		code: string;
		description: string;
		descriptor: string;
		penalty: Offense[];
	}[];
};

const surcharge10 = { type: 'percentage', value: 10, days: 30, every: 30 } as const;

/** A fictional "Dalisay City" ordinance set. Codes follow `TO_S<section>_<item>_<year>`. */
export const CATEGORIES: CategorySeed[] = [
	{
		name: 'Traffic Regulation',
		description: 'Rules on parking, driving conduct and driver licensing.',
		group: 'traffic',
		subs: ['Parking', 'Moving violations', 'Licensing and registration'],
		provisions: [
			{
				sub: 0,
				code: 'TO_S4_A.1_2024',
				description: 'Parking in a no-parking zone or in front of a driveway or fire hydrant.',
				descriptor: 'Illegal parking',
				penalty: [
					{ pecuniary: 500 },
					{ pecuniary: 1000, surcharge: surcharge10 },
					{ pecuniary: 2000, disciplinary: 'Vehicle may be towed at the owner’s expense.' }
				]
			},
			{
				sub: 0,
				code: 'TO_S4_A.2_2024',
				description: 'Double parking or obstructing the flow of traffic on a city road.',
				descriptor: 'Obstructing traffic',
				penalty: [
					{ pecuniary: 500 },
					{ pecuniary: 1000, surcharge: surcharge10 },
					{ pecuniary: 1500 }
				]
			},
			{
				sub: 0,
				code: 'TO_S4_A.3_2024',
				description: 'Leaving a vehicle unattended on a pedestrian crossing or sidewalk.',
				descriptor: 'Parking on sidewalk',
				penalty: [{ pecuniary: 750 }, { pecuniary: 1500, surcharge: surcharge10 }]
			},
			{
				sub: 1,
				code: 'TO_S4_B.1_2024',
				description: 'Driving a motorcycle without a helmet, or with a helmet left unfastened.',
				descriptor: 'No helmet',
				penalty: [
					{ pecuniary: 300 },
					{ pecuniary: 500, surcharge: surcharge10 },
					{ pecuniary: 1000, disciplinary: 'Attend a road safety seminar.' }
				]
			},
			{
				sub: 1,
				code: 'TO_S4_B.2_2024',
				description: 'Disregarding a traffic sign, signal or the directions of a traffic enforcer.',
				descriptor: 'Disregarding traffic signs',
				penalty: [
					{ pecuniary: 500 },
					{ pecuniary: 1000, surcharge: surcharge10 },
					{ pecuniary: 2000 }
				]
			},
			{
				sub: 1,
				code: 'TO_S4_B.3_2024',
				description: 'Overloading a motorcycle or tricycle beyond its rated passenger capacity.',
				descriptor: 'Overloading',
				penalty: [{ pecuniary: 500 }, { pecuniary: 1000, surcharge: surcharge10 }]
			},
			{
				sub: 1,
				code: 'TO_S4_B.4_2024',
				description: 'Using a mobile phone while driving a motor vehicle.',
				descriptor: 'Phone while driving',
				penalty: [
					{ pecuniary: 1000 },
					{ pecuniary: 2000, surcharge: surcharge10 },
					{ pecuniary: 3000 }
				]
			},
			{
				sub: 2,
				code: 'TO_S4_C.1_2024',
				description: 'Driving without carrying a valid driver’s license.',
				descriptor: 'No license on person',
				penalty: [
					{ pecuniary: 750 },
					{ pecuniary: 1500, surcharge: surcharge10 },
					{ pecuniary: 3000, disciplinary: 'Report to the licensing agency.' }
				]
			},
			{
				sub: 2,
				code: 'TO_S4_C.2_2024',
				description: 'Operating a tricycle or public utility vehicle without a valid franchise.',
				descriptor: 'No franchise',
				penalty: [{ pecuniary: 1500 }, { pecuniary: 3000, surcharge: surcharge10 }]
			}
		]
	},
	{
		name: 'Environmental Protection',
		description: 'Solid waste, pollution control and protection of trees and water bodies.',
		group: 'environment',
		subs: ['Solid waste', 'Pollution control', 'Land and water protection'],
		provisions: [
			{
				sub: 0,
				code: 'TO_S7_A.1_2024',
				description: 'Littering in a public place, road, park or waterway.',
				descriptor: 'Littering',
				penalty: [
					{ pecuniary: 500 },
					{ pecuniary: 1000, surcharge: surcharge10 },
					{ pecuniary: 2500 }
				]
			},
			{
				sub: 0,
				code: 'TO_S7_A.2_2024',
				description: 'Failure to segregate household waste at source.',
				descriptor: 'No waste segregation',
				penalty: [{ pecuniary: 300 }, { pecuniary: 600, surcharge: surcharge10 }]
			},
			{
				sub: 0,
				code: 'TO_S7_A.3_2024',
				description: 'Open burning of waste within the city.',
				descriptor: 'Open burning',
				penalty: [
					{ pecuniary: 1000 },
					{ pecuniary: 2500, surcharge: surcharge10 },
					{ pecuniary: 5000, disciplinary: 'Community service for up to five days.' }
				]
			},
			{
				sub: 1,
				code: 'TO_S7_B.1_2024',
				description: 'Operating a motor vehicle that emits excessive smoke.',
				descriptor: 'Smoke belching',
				penalty: [{ pecuniary: 1000 }, { pecuniary: 2000, surcharge: surcharge10 }]
			},
			{
				sub: 1,
				code: 'TO_S7_B.2_2024',
				description: 'Dumping wastewater or oil into a canal, drainage or road.',
				descriptor: 'Illegal discharge',
				penalty: [
					{ pecuniary: 2000 },
					{ pecuniary: 4000, surcharge: surcharge10 },
					{ pecuniary: 5000 }
				]
			},
			{
				sub: 2,
				code: 'TO_S7_C.1_2024',
				description: 'Cutting or damaging a tree on public land without a permit.',
				descriptor: 'Illegal tree cutting',
				penalty: [{ pecuniary: 2500 }, { pecuniary: 5000, surcharge: surcharge10 }]
			},
			{
				sub: 2,
				code: 'TO_S7_C.2_2024',
				description: 'Transporting soil, sand or gravel without a cover or safety nets.',
				descriptor: 'Uncovered load',
				penalty: [{ pecuniary: 5000 }, { pecuniary: 5000, surcharge: surcharge10 }]
			}
		]
	},
	{
		name: 'Public Order and Safety',
		description: 'Public conduct, noise and use of sidewalks and public spaces.',
		group: 'order',
		subs: ['Noise and nuisance', 'Public conduct', 'Sidewalk and market'],
		provisions: [
			{
				sub: 0,
				code: 'TO_S9_A.1_2024',
				description: 'Playing loud music or using a karaoke machine during quiet hours.',
				descriptor: 'Loud noise',
				penalty: [
					{ pecuniary: 500 },
					{ pecuniary: 1000, surcharge: surcharge10 },
					{ pecuniary: 2000 }
				]
			},
			{
				sub: 0,
				code: 'TO_S9_A.2_2024',
				description: 'Modifying a muffler to produce excessive engine noise.',
				descriptor: 'Modified muffler',
				penalty: [{ pecuniary: 1000 }, { pecuniary: 2000, surcharge: surcharge10 }]
			},
			{
				sub: 1,
				code: 'TO_S9_B.1_2024',
				description: 'Drinking alcohol or urinating in a public place.',
				descriptor: 'Public indecency',
				penalty: [{ pecuniary: 500 }, { pecuniary: 1000, surcharge: surcharge10 }]
			},
			{
				sub: 1,
				code: 'TO_S9_B.2_2024',
				description: 'Smoking in an enclosed public place or within a designated smoke-free zone.',
				descriptor: 'Smoking in public',
				penalty: [{ pecuniary: 500 }, { pecuniary: 1500, surcharge: surcharge10 }]
			},
			{
				sub: 1,
				code: 'TO_S9_B.3_2024',
				description: 'Being a minor found out in public after the city curfew hour.',
				descriptor: 'Curfew violation',
				penalty: [
					{ pecuniary: 0, disciplinary: 'Release to a parent or guardian with a warning.' },
					{ pecuniary: 500 }
				]
			},
			{
				sub: 2,
				code: 'TO_S9_C.1_2024',
				description: 'Placing goods or stalls on a sidewalk so that pedestrians cannot pass.',
				descriptor: 'Sidewalk obstruction',
				penalty: [
					{ pecuniary: 500 },
					{ pecuniary: 1000, surcharge: surcharge10 },
					{ pecuniary: 1500 }
				]
			},
			{
				sub: 2,
				code: 'TO_S9_C.2_2024',
				description: 'Selling goods on a street or public space without a vendor permit.',
				descriptor: 'No vendor permit',
				penalty: [{ pecuniary: 750 }, { pecuniary: 1500, surcharge: surcharge10 }]
			}
		]
	}
];

export const FIRST_NAMES_F = [
	'Maria',
	'Liza',
	'Angelica',
	'Rosalie',
	'Jocelyn',
	'Cherry',
	'Marites',
	'Analyn',
	'Mylene',
	'Gemma',
	'Rhea',
	'Divina',
	'Lourdes',
	'Fe',
	'Corazon',
	'Nelia',
	'Shiela',
	'Joy',
	'Mary Ann',
	'Imelda'
];

export const FIRST_NAMES_M = [
	'Juan',
	'Jose',
	'Mark',
	'Jericho',
	'Ronaldo',
	'Eduardo',
	'Rodel',
	'Arnel',
	'Nestor',
	'Danilo',
	'Romeo',
	'Efren',
	'Jomar',
	'Christian',
	'Glenn',
	'Ariel',
	'Joel',
	'Reynaldo',
	'Allan',
	'Rolando',
	'Bernard',
	'Dennis',
	'Wilfredo',
	'Alvin'
];

export const LAST_NAMES = [
	'Santos',
	'Reyes',
	'Cruz',
	'Bautista',
	'Ocampo',
	'Garcia',
	'Mendoza',
	'Torres',
	'Flores',
	'Ramos',
	'Aquino',
	'Castillo',
	'Rivera',
	'Domingo',
	'Navarro',
	'Pascual',
	'Soriano',
	'Villanueva',
	'Gonzales',
	'Lopez',
	'Fernandez',
	'Salazar',
	'Dizon',
	'Manalo',
	'Panganiban',
	'Lacson',
	'Macaraeg',
	'Evangelista',
	'Tolentino',
	'Cabrera',
	'Mercado',
	'Aguilar',
	'Dimaculangan',
	'Alcantara',
	'Magbanua',
	'Enriquez'
];

export const MIDDLE_NAMES = [
	'Dela Cruz',
	'Bautista',
	'Santiago',
	'Perez',
	'Valdez',
	'Hernandez',
	'Morales',
	'Ignacio',
	'Robles',
	'Estrada',
	''
];

export const STREETS = [
	'Rizal Avenue',
	'Mabini Street',
	'National Highway',
	'Quezon Boulevard',
	'Bonifacio Street',
	'Del Pilar Street',
	'Burgos Street',
	'Luna Street',
	'Magsaysay Avenue',
	'Public Market Road',
	'City Hall Road',
	'Coastal Road',
	'Aguinaldo Street',
	'Sampaguita Street',
	'Ilang-Ilang Street'
];

export const REMARKS = [
	'',
	'',
	'',
	'Driver was cooperative.',
	'Violator was advised of the payment deadline.',
	'Apprehended during a regular patrol.',
	'Reported by a resident.',
	'Warned previously.'
];
