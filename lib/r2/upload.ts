import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { randomBytes } from "node:crypto"
import sharp from "sharp"
import { getR2Client } from "./client"

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export type UploadKind = "product-image" | "guarantee"

interface DetectedImage {
  mime: string
  ext:  string
}

/**
 * The browser-supplied MIME type and file name are NOT trusted: the real type is read from the
 * file's magic bytes, and the stored extension/content-type come from that result.
 */
export function detectImage(buf: Buffer): DetectedImage | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", ext: "png" }
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mime: "image/webp", ext: "webp" }
  }
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString("ascii"))) return { mime: "image/gif", ext: "gif" }
  return null
}

/** Safety net: every stored image is at most ~TARGET_BYTES, whatever the browser sent. */
const TARGET_BYTES = 200 * 1024

/**
 * Re-encodes an image as WebP, auto-rotated, with all metadata (GPS position, camera info) removed,
 * shrinking quality and then size until it fits the target. Keeps cloud storage small.
 */
export async function compressForStorage(input: Buffer, maxDimension: number): Promise<Buffer> {
  let dimension = maxDimension
  let best: Buffer = input
  for (let round = 0; round < 4; round++) {
    for (const quality of [80, 70, 60, 50, 40]) {
      const out = await sharp(input, { animated: false })
        .rotate()                                                       // apply EXIF orientation
        .resize({ width: dimension, height: dimension, fit: "inside", withoutEnlargement: true })
        .webp({ quality })
        .toBuffer()
      if (best === input || out.length < best.length) best = out
      if (out.length <= TARGET_BYTES) return out
    }
    dimension = Math.round(dimension * 0.8)
  }
  return best
}

export function assertUploadSize(size: number): void {
  if (size <= 0) throw new Error("ملف فارغ")
  if (size > MAX_SIZE) throw new Error("الملف كبير جدا. الحد الأقصى 10 ميغابايت.")
}

/**
 * Guarantee documents (ID card, passport, licence) go to a PRIVATE bucket when
 * CLOUDFLARE_R2_PRIVATE_BUCKET_NAME is set, and are only ever served through the authenticated
 * /api/files route. Without it they share the main bucket (set the variable to fix that).
 */
function bucketFor(kind: UploadKind): string {
  if (kind === "guarantee" && process.env.CLOUDFLARE_R2_PRIVATE_BUCKET_NAME) {
    return process.env.CLOUDFLARE_R2_PRIVATE_BUCKET_NAME
  }
  return process.env.CLOUDFLARE_R2_BUCKET_NAME!
}

export function buildR2Key(kind: UploadKind, ext: string): string {
  return `${kind}/${Date.now()}-${randomBytes(12).toString("hex")}.${ext}`
}

export interface UploadResult {
  /** URL to store in the database */
  url: string
  key: string
}

export async function uploadImage(buffer: Buffer, kind: UploadKind): Promise<UploadResult> {
  assertUploadSize(buffer.length)
  // The real file type is read from the bytes; anything that is not a genuine image is refused.
  if (!detectImage(buffer)) throw new Error("نوع الملف غير مسموح. الصيغ المقبولة: JPEG، PNG، WebP، GIF.")

  let stored: Buffer
  try {
    stored = await compressForStorage(buffer, kind === "guarantee" ? 1800 : 1600)
  } catch {
    throw new Error("تعذر معالجة الصورة، جرّب صورة أخرى")
  }

  const key = buildR2Key(kind, "webp")
  await getR2Client().send(
    new PutObjectCommand({
      Bucket:       bucketFor(kind),
      Key:          key,
      Body:         stored,
      ContentType:  "image/webp",
      CacheControl: kind === "guarantee" ? "private, max-age=0" : "public, max-age=31536000, immutable",
    })
  )

  return {
    key,
    url: kind === "guarantee"
      ? `/api/files/${key}`                              // private: always through the auth route
      : `${process.env.CLOUDFLARE_R2_PUBLIC_URL!}/${key}`, // product photos are public catalogue assets
  }
}

export async function getPrivateObject(key: string) {
  const res = await getR2Client().send(
    new GetObjectCommand({ Bucket: bucketFor("guarantee"), Key: key })
  )
  return res
}
