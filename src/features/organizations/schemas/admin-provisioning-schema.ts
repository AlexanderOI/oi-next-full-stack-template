import { z } from "zod";

import { localeSchema } from "@/i18n/config";

const normalizedNameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, " "))
  .pipe(z.string().min(2, "NAME_MIN").max(120, "NAME_MAX"));

const normalizedEmailSchema = z.string().trim().toLowerCase().pipe(z.email("EMAIL_INVALID"));

const normalizedUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .string()
      .min(3, "USERNAME_MIN")
      .max(30, "USERNAME_MAX")
      .regex(/^[a-z0-9.]+$/, "USERNAME_FORMAT")
  );

export const organizationProvisioningSchema = z.object({
  name: normalizedNameSchema,
  email: normalizedEmailSchema,
  username: normalizedUsernameSchema,
  locale: localeSchema,
  restricted: z.boolean(),
});

export type OrganizationProvisioningInput = z.input<typeof organizationProvisioningSchema>;
