import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { s3Client } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const attemptId = formData.get("attemptId") as string | null;
    const questionId = formData.get("questionId") as string | null;

    if (!file || !attemptId || !questionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate file type (PDF only) and size (10 MB max)
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Invalid file type. Only PDFs are allowed." }, { status: 400 });
    }

    const MAX_PDF_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "File exceeds 10 MB limit." }, { status: 400 });
    }

    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      console.error("[POST /api/student/upload] S3_BUCKET_NAME environment variable is not set.");
      return NextResponse.json({ error: "S3 storage is not configured." }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `grader-uploads/attempt_${attemptId}_q_${questionId}_${Date.now()}_${sanitizedName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type || "application/pdf",
      })
    );

    return NextResponse.json({ fileUrl: s3Key });
  } catch (err) {
    console.error("[POST /api/student/upload] Failed to upload PDF file", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
