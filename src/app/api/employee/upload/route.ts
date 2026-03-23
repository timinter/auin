import { requireRole } from "@/lib/auth";
import { MAX_FILE_SIZE, EMPLOYEE_ALLOWED_TYPES, EMPLOYEE_ALLOWED_EXTENSIONS } from "@/lib/upload/constants";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const auth = await requireRole("employee");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
    if (!EMPLOYEE_ALLOWED_TYPES.includes(file.type as typeof EMPLOYEE_ALLOWED_TYPES[number])) {
      return NextResponse.json({ error: "File type not allowed. Accepted: PDF, PNG, JPEG" }, { status: 400 });
    }

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!EMPLOYEE_ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: "File extension not allowed" }, { status: 400 });
    }

    const fileName = `${user.id}/receipt_${Date.now()}.${ext}`;

    const { error: uploadError } = await serviceClient.storage
      .from("freelancer-files")
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (uploadError) return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });

    const { data: signedUrlData, error: signError } = await serviceClient.storage
      .from("freelancer-files")
      .createSignedUrl(fileName, 3600);

    if (signError || !signedUrlData) {
      return NextResponse.json({ error: "File uploaded but failed to generate URL" }, { status: 500 });
    }

    return NextResponse.json({ url: signedUrlData.signedUrl, path: fileName });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
