import { z } from "zod";

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1024),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
  userAgent: z.string().max(255).optional(),
});

export const pushEndpointSchema = z.object({
  endpoint: z.string().url().max(1024),
});
