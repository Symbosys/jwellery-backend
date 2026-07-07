import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import ENV from "./env.js";
if (ENV.cloud_name && ENV.cloud_api_key && ENV.cloud_api_secret) {
  cloudinary.config({
    cloud_name: ENV.cloud_name,
    api_key: ENV.cloud_api_key,
    api_secret: ENV.cloud_api_secret,
  });
}

export default cloudinary;

export const uploadToCloudinary = (
  fileBuffer: Buffer,
  folder: string
): Promise<{ public_id: string; secure_url: string }> => {
  if (!ENV.cloud_name || !ENV.cloud_api_key || !ENV.cloud_api_secret) {
    return Promise.reject(new Error("Cloudinary credentials are missing. Please configure them in your .env file."));
  }
  console.log("[DEBUG] uploadToCloudinary config:", cloudinary.config());
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) {
          return reject(
            new Error("Failed to upload image to Cloudinary: " + error.message)
          );
        }
        if (!result?.secure_url || !result.public_id) {
          return reject(
            new Error(
              "Failed to retrieve public_id or URL from Cloudinary response"
            )
          );
        }
        resolve({
          public_id: result.public_id,
          secure_url: result.secure_url,
        });
      }
    );

    // console.log(uploadStream.map((r) => console.log(r)));

    // Create a readable stream from the file buffer and pipe it to the upload stream
    const stream = Readable.from(fileBuffer);
    
    stream.on('error', (err) => {
      console.error("[DEBUG] Readable stream error:", err);
      reject(new Error("Readable stream error: " + err.message));
    });
    
    uploadStream.on('error', (err) => {
      console.error("[DEBUG] Cloudinary upload stream error:", err);
      reject(new Error("Cloudinary upload stream error: " + err.message));
    });

    stream.pipe(uploadStream);
  });
};

export const deleteFromCloudinary = (publicId: string): Promise<void> => {
  if (!ENV.cloud_name || !ENV.cloud_api_key || !ENV.cloud_api_secret) {
    return Promise.reject(new Error("Cloudinary credentials are missing. Please configure them in your .env file."));
  }
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