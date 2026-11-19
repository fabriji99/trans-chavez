import { z } from "zod";

export const newTicketSchema = z.object({
  trip_id: z.string().uuid(),
  boarding_stop_id: z.string().uuid(),
  alighting_stop_id: z.string().uuid(),
  passenger_count: z.number().int().positive().default(1),
  fare_amount: z.number().nonnegative(),
  payment_method: z.literal("cash").default("cash"),
  created_by: z.string().uuid(),
});
export type NewTicketInput = z.infer<typeof newTicketSchema>;

export const newRouteSchema = z.object({
  name: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
});
export type NewRouteInput = z.infer<typeof newRouteSchema>;

export const newStopSchema = z.object({
  route_id: z.string().uuid(),
  name: z.string().min(1),
  sequence: z.number().int().positive(),
});
export type NewStopInput = z.infer<typeof newStopSchema>;

export const newFareSchema = z.object({
  route_id: z.string().uuid(),
  from_stop_id: z.string().uuid(),
  to_stop_id: z.string().uuid(),
  price: z.number().nonnegative(),
});
export type NewFareInput = z.infer<typeof newFareSchema>;

export const tripDirectionSchema = z.enum(["outbound", "return"]);

export const stopPriceSchema = z.object({
  stop_id: z.string().uuid(),
  direction: tripDirectionSchema,
  price_to_end: z.number().nonnegative(),
});
export type StopPriceInput = z.infer<typeof stopPriceSchema>;

export const newTripSchema = z.object({
  route_id: z.string().uuid(),
  direction: tripDirectionSchema.default("outbound"),
  bus_id: z.string().uuid(),
  cobrador_id: z.string().uuid(),
  driver_id: z.string().uuid().nullable().default(null),
  departure_at: z.string().datetime(),
});
export type NewTripInput = z.infer<typeof newTripSchema>;

export const newDriverSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre es requerido."),
  phone: z.string().trim().nullable().default(null),
});
export type NewDriverInput = z.infer<typeof newDriverSchema>;

/** Los cobradores entran con un usuario simple; por dentro es un correo local ficticio. */
export const LOCAL_EMAIL_DOMAIN = "transchavez.local";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9._-]{3,30}$/,
    "El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo (sin espacios ni acentos).",
  );

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${LOCAL_EMAIL_DOMAIN}`;
}

export function emailToUsername(email: string): string {
  return email.endsWith(`@${LOCAL_EMAIL_DOMAIN}`)
    ? email.slice(0, -(LOCAL_EMAIL_DOMAIN.length + 1))
    : email;
}
