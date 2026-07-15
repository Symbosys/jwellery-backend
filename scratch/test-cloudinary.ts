import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

console.log("Starting test using base64 upload...");

const sampleBase64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const buffer = Buffer.from(sampleBase64, "base64");

const fileUri = `data:image/jpeg;base64,${buffer.toString("base64")}`;

cloudinary.uploader.upload(fileUri, { folder: "test" })
  .then((result) => {
    console.log("Upload result:", {
      public_id: result.public_id,
      secure_url: result.secure_url
    });
  })
  .catch((error) => {
    console.error("Upload error:", error);
  });
