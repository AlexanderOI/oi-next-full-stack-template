import { z } from "zod";

export const avatarSchema = z
  .file()
  .max(5 * 1024 * 1024, "Image must be smaller than 5MB")
  .mime(
    ["image/jpeg", "image/png", "image/webp", "image/avif"],
    "Please select a supported image file"
  );
