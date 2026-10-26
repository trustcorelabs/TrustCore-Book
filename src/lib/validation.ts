import { hasPermission } from "@/shared/policies/permissions";
import { z } from "zod";
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address").max(254)),
  password: z
    .string()
    .min(1, "Enter your password")
    .max(72, "Use at most 72 UTF-8 bytes")
    .refine(
      (v) => new TextEncoder().encode(v).length <= 72,
      "Use at most 72 UTF-8 bytes",
    ),
});
export const registerSchema = loginSchema.extend({
  name: z
    .string()
    .trim()
    .min(2, "Enter your full name (at least 2 characters)")
    .max(100, "Use at most 100 characters"),
  password: z
    .string()
    .min(12, "Use at least 12 characters")
    .max(72, "Use at most 72 UTF-8 bytes")
    .refine(
      (v) => new TextEncoder().encode(v).length <= 72,
      "Use at most 72 UTF-8 bytes",
    ),
});
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
});
export const passwordChangeSchema = z.object({
  currentPassword: loginSchema.shape.password,
  newPassword: registerSchema.shape.password,
});
export const accountEmailSchema = z.object({
  email: loginSchema.shape.email,
});
export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  password: registerSchema.shape.password,
});
export const markets = {
  LK: { name: "Sri Lanka", currency: "LKR", timezone: "Asia/Colombo" },
  MV: { name: "Maldives", currency: "MVR", timezone: "Indian/Maldives" },
  AE: { name: "United Arab Emirates", currency: "AED", timezone: "Asia/Dubai" },
  AU: { name: "Australia", currency: "AUD", timezone: "Australia/Sydney" },
} as const;
export const businessSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and single hyphens",
    ),
  country: z.enum(["LK", "MV", "AE", "AU"]),
  timezone: z
    .string()
    .max(100)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return v.includes("/");
      } catch {
        return false;
      }
    }, "Use an IANA timezone"),
});
export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  durationMinutes: z.coerce.number().int().min(5).max(720),
  kind: z.enum(["SERVICE", "PACKAGE", "ADDON"]).default("SERVICE"),
  categoryId: z
    .union([z.string().cuid(), z.literal(""), z.null()])
    .default(null)
    .transform((v) => v || null),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(180).default(0),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(180).default(0),
  components: z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      if (v.length > 2048) return null;
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    },
    z
      .array(
        z.object({
          componentId: z.string().cuid(),
          quantity: z.number().int().min(1).max(10),
        }),
      )
      .max(10)
      .default([]),
  ),
  price: z
    .string()
    .regex(
      /^\d{1,8}(\.\d{1,2})?$/,
      "Enter a nonnegative amount, up to two decimals",
    ),
});
export const staffSchema = z.object({
  name: z.string().trim().min(2).max(100),
});
export const serviceEditSchema = serviceSchema.extend({
  id: z.string().cuid(),
  active: z.boolean(),
});
export const staffEditSchema = staffSchema.extend({
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(180).default(0),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(180).default(0),
  id: z.string().cuid(),
  active: z.boolean(),
});
export const staffScheduleSchema = z.object({
  staffId: z.string().cuid(),
  serviceIds: z.array(z.string().cuid()).max(100),
  rules: z
    .array(
      z
        .object({
          weekday: z.number().int().min(0).max(6),
          startMinute: z.number().int().min(0).max(1439),
          endMinute: z.number().int().min(1).max(1440),
        })
        .refine((rule) => rule.endMinute > rule.startMinute),
    )
    .max(7)
    .refine(
      (rules) =>
        new Set(rules.map((rule) => rule.weekday)).size === rules.length,
    ),
});
export const customerSchema = staffSchema.extend({
  email: z.union([z.email().max(254), z.literal("")]),
  phone: z
    .string()
    .max(30)
    .refine(
      (v) => !v || /^\+?[0-9 ()-]{6,30}$/.test(v),
      "Enter a valid phone number",
    ),
});
export function canManage(role: string) {
  return (
    (role === "OWNER" || role === "ADMIN") &&
    hasPermission(role, "records.manage")
  );
}

export const bookingPolicySchema = z.object({
  bookingLeadMinutes: z.coerce.number().int().min(0).max(10080),
  cancellationNoticeMinutes: z.coerce.number().int().min(0).max(10080),
  rescheduleNoticeMinutes: z.coerce.number().int().min(0).max(10080),
  bookingHorizonDays: z.coerce.number().int().min(1).max(180),
});
