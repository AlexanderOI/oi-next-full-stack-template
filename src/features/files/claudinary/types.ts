export interface UploadImageOptions {
  folder?: string;
  publicId?: string;

  width?: number;
  height?: number;

  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  format?: "auto" | "webp" | "avif" | "jpg" | "png";
  quality?: "auto" | number;

  maxFileSize?: number;
  allowedMimeTypes?: string[];
}

export interface UploadedImage {
  publicId: string;
  url: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}
