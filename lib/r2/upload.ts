import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getR2Client } from "./client"

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
])

interface UploadResult {
  url: string
  key: string
}

export async function uploadToR2(
  buffer: Buffer,
  key: string,
  mimeType: string,
  fileSize: number
): Promise<UploadResult> {
  if (fileSize > MAX_SIZE) {
    throw new Error("Fichier trop volumineux. Maximum 10 MB.")
  }
  if (!ALLOWED_TYPES.has(mimeType)) {
    throw new Error("Type de fichier non autorisé. Formats acceptés : JPEG, PNG, WebP, GIF.")
  }

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  )

  return {
    key,
    url: `${process.env.CLOUDFLARE_R2_PUBLIC_URL!}/${key}`,
  }
}

export async function deleteFromR2(key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: key,
    })
  )
}

export function buildR2Key(folder: string, originalFilename: string): string {
  const ts     = Date.now()
  const rand   = Math.random().toString(36).slice(2, 8)
  const ext    = originalFilename.split(".").pop() ?? "bin"
  return `${folder}/${ts}-${rand}.${ext}`
}