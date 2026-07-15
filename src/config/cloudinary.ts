import { v2 as cloudinary } from "cloudinary";
import ENV from "./env.js";

if (ENV.cloud_name && ENV.cloud_api_key && ENV.cloud_api_secret) {
  cloudinary.config({
    cloud_name: ENV.cloud_name,
    api_key: ENV.cloud_api_key,
    api_secret: ENV.cloud_api_secret,
  });
}

export default cloudinary;

export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  folder: string
): Promise<{ public_id: string; secure_url: string }> => {
  if (!ENV.cloud_name || !ENV.cloud_api_key || !ENV.cloud_api_secret) {
    throw new Error("Cloudinary credentials are missing. Please configure them in your .env file.");
  }

  // Explicitly configure before request to avoid unsigned fallback issues
  cloudinary.config({
    cloud_name: ENV.cloud_name,
    api_key: ENV.cloud_api_key,
    api_secret: ENV.cloud_api_secret,
  });

  const base64Data = fileBuffer.toString("base64");
  const fileUri = `data:image/jpeg;base64,${base64Data}`;

  try {
    const result = await cloudinary.uploader.upload(fileUri, {
      folder,
    });

    if (!result?.secure_url || !result.public_id) {
      throw new Error("Failed to retrieve public_id or URL from Cloudinary response");
    }

    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
    };
  } catch (error: any) {
    throw new Error("Failed to upload image to Cloudinary: " + error.message);
  }
};

export const deleteFromCloudinary = (publicId: string): Promise<void> => {
  if (!ENV.cloud_name || !ENV.cloud_api_key || !ENV.cloud_api_secret) {
    return Promise.reject(new Error("Cloudinary credentials are missing. Please configure them in your .env file."));
  }

  // Explicitly configure before request to avoid unsigned fallback issues
  cloudinary.config({
    cloud_name: ENV.cloud_name,
    api_key: ENV.cloud_api_key,
    api_secret: ENV.cloud_api_secret,
  });

  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        return reject(
          new Error("Failed to delete image from Cloudinary: " + error.message)
        );
      }
      resolve();
    });
  });
};