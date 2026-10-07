export type ServiceReturn<T = undefined> =
	| { success: true; message: string; data: T }
	| { success: false; message: string; fields?: Record<string, string>; data?: undefined };

export function service_fail(
	message: string,
	fields?: Record<string, string>
): ServiceReturn<never> {
	return { success: false, message, fields };
}

export function service_ok<T = undefined>(message: string, data?: T): ServiceReturn<T> {
	return { success: true, message, data: data as T };
}
