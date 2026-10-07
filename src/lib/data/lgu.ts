/** The fictional local government this demo is branded as. Real LGU names, seals and places must not appear in the demo. */
export const lgu = {
	/** Letterhead / sidebar name */
	name: 'City Government of Dalisay',
	/** Address-style name, as written in a violator's address */
	city: 'City of Dalisay',
	/** Matches the city a violator's address starts with (the `City of` prefix is optional) */
	city_pattern: /dalisay/i,
	province: 'Mabuhay',
	/** Where citations are paid, as printed on the billing statement */
	payment_office: 'City Treasury Office',
	payment_address: 'City Hall Compound, Poblacion'
} as const;
