import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ uploadStream: vi.fn(), end: vi.fn() }));

vi.mock("@/services/storage/cloudinary/client", () => ({
  cloudinary: { uploader: { upload_stream: mocks.uploadStream } },
}));

import { uploadImage } from "@/services/storage/cloudinary/upload-image";

function file(type: string, size: number, bytes = new Uint8Array([1, 2, 3])) {
  return {
    type,
    size,
    arrayBuffer: vi.fn(async () => bytes.buffer),
  } as unknown as File;
}

describe("uploadImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadStream.mockImplementation((_options, callback) => {
      callback(null, {
        public_id: "avatars/user-1",
        url: "http://cdn.example.com/avatar.png",
        secure_url: "https://cdn.example.com/avatar.png",
        width: 256,
        height: 256,
        format: "png",
        bytes: 3,
      });
      return { end: mocks.end };
    });
  });

  it.each([
    [file("image/gif", 3), {}, "Unsupported image type: image/gif"],
    [file("image/png", 4), { maxFileSize: 3 }, "Image exceeds maximum size of 3 bytes"],
  ])("rejects invalid files before opening a provider stream", async (input, options, message) => {
    await expect(uploadImage(input, options)).rejects.toThrow(message);
    expect(mocks.uploadStream).not.toHaveBeenCalled();
  });

  it("maps transformation options and returns the provider's secure result", async () => {
    const result = await uploadImage(file("image/png", 3), {
      folder: "my-app/avatars",
      publicId: "user-1",
      width: 256,
      height: 256,
      fit: "contain",
      format: "webp",
      quality: 80,
    });

    expect(mocks.uploadStream).toHaveBeenCalledWith(
      {
        folder: "my-app/avatars",
        public_id: "user-1",
        resource_type: "image",
        transformation: {
          width: 256,
          height: 256,
          crop: "contain",
          fetch_format: "webp",
          quality: 80,
        },
      },
      expect.any(Function)
    );
    expect(mocks.end).toHaveBeenCalledWith(Buffer.from([1, 2, 3]));
    expect(result).toEqual({
      publicId: "avatars/user-1",
      url: "http://cdn.example.com/avatar.png",
      secureUrl: "https://cdn.example.com/avatar.png",
      width: 256,
      height: 256,
      format: "png",
      bytes: 3,
    });
  });

  it("propagates provider upload errors", async () => {
    mocks.uploadStream.mockImplementation((_options, callback) => {
      callback(new Error("provider rejected upload"));
      return { end: mocks.end };
    });

    await expect(uploadImage(file("image/png", 3))).rejects.toThrow("provider rejected upload");
  });

  it("rejects an empty provider callback result", async () => {
    mocks.uploadStream.mockImplementation((_options, callback) => {
      callback(null, undefined);
      return { end: mocks.end };
    });

    await expect(uploadImage(file("image/png", 3))).rejects.toThrow(
      "Cloudinary returned no result"
    );
  });
});
