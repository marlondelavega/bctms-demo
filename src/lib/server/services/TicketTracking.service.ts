import TicketTrackingModel from '../models/TicketTracking.model';

export async function getTicketTracking_byIssuance(issuance_id: string) {
	const query = TicketTrackingModel.find({ issuance: issuance_id })
		.populate('issuance')
		.populate('changed_by');
	return query;
}
