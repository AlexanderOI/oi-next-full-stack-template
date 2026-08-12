"use server";

import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "./client";
import type { UploadedImage, UploadImageOptions } from "./types";

const DEFAULT_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function validateFile(file: File, options: UploadImageOptions): void {
  const allowedMimeTypes = options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;

  const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;

  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error(`Unsupported image type: ${file.type}`);
  }

  if (file.size > maxFileSize) {
    throw new Error(`Image exceeds maximum size of ${maxFileSize} bytes`);
  }
}

export async function uploadImageCloudinary(
  file: File,
  options: UploadImageOptions = {}
): Promise<UploadedImage> {
  validateFile(file, options);

  const {
    folder,
    publicId,
    width,
    height,
    fit = "cover",
    format = "auto",
    quality = "auto",
  } = options;

  const buffer = Buffer.from(await file.arrayBuffer());

  const transformation: Record<string, unknown> = {};

  if (width || height) {
    transformation.width = width;
    transformation.height = height;

    transformation.crop = fit === "cover" ? "fill" : fit;
  }

  if (format !== "auto") {
    transformation.fetch_format = format;
  } else {
    transformation.fetch_format = "auto";
  }

  if (quality !== undefined) {
    transformation.quality = quality;
  }

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: "image",

        transformation: Object.keys(transformation).length > 0 ? transformation : undefined,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary returned no result"));
          return;
        }

        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });

  return {
    publicId: result.public_id,
    url: result.url,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
}
