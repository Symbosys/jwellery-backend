import { uploadToCloudinary } from "../config/cloudinary.js";

export async function processBase64Image(
  base64String: string | null | undefined,
  folder: string
): Promise<string | null> {
  if (!base64String) {
    return null;
  }
  if (!base64String.startsWith("data:image")) {
    return base64String;
  }
  const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3 || !matches[2]) {
    return base64String;
  }
  const imageBuffer = Buffer.from(matches[2] as string, "base64");
  const result = await uploadToCloudinary(imageBuffer, folder);
  return result.secure_url;
}
