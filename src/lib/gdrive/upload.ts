import { type drive_v3 } from "googleapis";
import { getDriveClient } from "./client";
import { Readable } from "stream";

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

interface UploadResult {
  fileId: string;
  webViewLink: string;
}

/**
 * Upload a PDF buffer to Google Drive.
 * Organizes files into: Root / {year} / {month} / {entity} /
 *
 * Returns the Drive file ID and web view link, or null if Drive is not configured.
 */
export async function uploadPdfToDrive(
  buffer: Buffer | Uint8Array,
  filename: string,
  meta: { year: number; month: number; entity: string }
): Promise<UploadResult | null> {
  const drive = getDriveClient();
  if (!drive || !ROOT_FOLDER_ID) return null;

  try {
    const yearFolder = await findOrCreateFolder(drive, String(meta.year), ROOT_FOLDER_ID);
    const monthFolder = await findOrCreateFolder(drive, String(meta.month).padStart(2, "0"), yearFolder);
    const entityFolder = await findOrCreateFolder(drive, meta.entity, monthFolder);

    const res = await drive.files.create({
      requestBody: {
        name: filename,
        mimeType: "application/pdf",
        parents: [entityFolder],
      },
      media: {
        mimeType: "application/pdf",
        body: Readable.from(Buffer.from(buffer)),
      },
      fields: "id, webViewLink",
    });

    if (!res.data.id) {
      console.error("Drive upload returned no file ID");
      return null;
    }

    return {
      fileId: res.data.id,
      webViewLink: res.data.webViewLink || "",
    };
  } catch (err) {
    console.error("Google Drive upload error:", err);
    return null;
  }
}

async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string
): Promise<string> {
  const query = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const list = await drive.files.list({
    q: query,
    fields: "files(id)",
    spaces: "drive",
  });

  const existing = list.data.files?.[0];
  if (existing?.id) return existing.id;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  if (!created.data.id) throw new Error(`Failed to create folder: ${name}`);
  return created.data.id;
}
