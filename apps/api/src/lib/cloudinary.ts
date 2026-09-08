import path from "path";
import { v4 as uuidv4 } from "uuid";
import { v2 as cloudinary } from "cloudinary";

// Credentials come from the Render environment variables:
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload an in-memory file buffer to Cloudinary.
 * Files never touch the server disk (Render's free disk is wiped on every
 * deploy), so uploads stream straight from the request to the cloud.
 *
 * Returns the permanent CDN URL plus the public id (needed if we ever
 * want to delete the file from Cloudinary later).
 */
export function uploadBufferToCloudinary(
  buffer: Buffer,
  originalName: string,
  folder: string,
  mimeType: string,
): Promise<{ url: string; publicId: string }> {
  // Build a safe, unique public id from the original filename.
  const ext = path.extname(originalName); // includes the dot, e.g. ".pdf"
  const base =
    path
      .basename(originalName, ext)
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "file";

  const shortId = uuidv4().slice(0, 8);

  // Images/videos: Cloudinary appends the format itself.
  // Other files (pdf, docs...): keep the extension so the CDN link ends
  // with .pdf etc and browsers can preview instead of dumping bytes.
  const keepExt =
    !mimeType.startsWith("image/") && !mimeType.startsWith("video/");
  const publicId = `${base}-${shortId}${keepExt ? ext : ""}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: "auto",
      },
      (error: any, result: any) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed"));
          return;
        }
        resolve({
          url: result.secure_url as string,
          publicId: result.public_id as string,
        });
      },
    );
    stream.end(buffer);
  });
}

export { cloudinary };