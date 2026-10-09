import { z } from "zod";

import { isReservedOrganizationSlug } from "../constants/organization-reserved-slugs";
import {
  MAX_ORGANIZATION_SLUG_LENGTH,
  normalizeOrganizationSlug,
} from "../utils/normalize-organization-slug";

export const organizationSlugSchema = z
  .string()
  .trim()
  .max(MAX_ORGANIZATION_SLUG_LENGTH, "ORGANIZATION_SLUG_MAX")
  .transform(normalizeOrganizationSlug)
  .pipe(
    z
      .string()
      .min(1, "ORGANIZATION_SLUG_REQUIRED")
      .refine((slug) => !isReservedOrganizationSlug(slug), "ORGANIZATION_SLUG_RESERVED")
  );
