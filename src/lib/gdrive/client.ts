import { google, type drive_v3 } from "googleapis";

let driveClient: drive_v3.Drive | null = null;

/**
 * Returns a Google Drive client authenticated via service account.
 * Returns null if the service account key is not configured.
 */
export function getDriveClient(): drive_v3.Drive | null {
  if (driveClient) return driveClient;

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return null;

  try {
    const key = JSON.parse(keyJson);
    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    driveClient = google.drive({ version: "v3", auth });
    return driveClient;
  } catch (err) {
    console.error("Failed to initialize Google Drive client:", err);
    return null;
  }
}
