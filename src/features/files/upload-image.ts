"use server";

import { uploadImageCloudinary } from "./claudinary/upload-image";

export const uploadAvatar = async (file: File) => {
  const result = await uploadImageCloudinary(file, {
    folder: "my-app/avatars",
    width: 256,
    height: 256,
    fit: "cover",
    format: "auto",
    quality: "auto",
  });

  return result;
};
