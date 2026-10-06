/**
 * Shrinks a photo in the browser BEFORE it is uploaded: a phone photo of 4-8 MB becomes ~100-200 KB.
 * This saves storage, bandwidth and upload time on a shop connection.
 * (The server compresses again as a safety net, so this is an optimisation, never a requirement.)
 */

export interface CompressOptions {
  /** target size: the work stops as soon as the result is below it (the server guarantees ~200 KB) */
  maxBytes?: number
  /** longest side in pixels */
  maxDimension?: number
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" applies the EXIF rotation (phone photos are often stored sideways)
      return await createImageBitmap(file, { imageOrientation: "from-image" })
    } catch {
      /* fall through to <img> */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("لا يمكن قراءة الصورة")) }
    img.src = url
  })
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const maxBytes = opts.maxBytes ?? 200 * 1024
  const maxDimension = opts.maxDimension ?? 1600

  if (!file.type.startsWith("image/")) throw new Error("الملف المحدد ليس صورة")

  const bitmap = await loadBitmap(file)
  const srcW = "naturalWidth" in bitmap ? bitmap.naturalWidth : bitmap.width
  const srcH = "naturalHeight" in bitmap ? bitmap.naturalHeight : bitmap.height

  // Already small and already modern: keep as is (no useless quality loss)
  if (file.size <= maxBytes && Math.max(srcW, srcH) <= maxDimension && (file.type === "image/webp" || file.type === "image/jpeg")) {
    return file
  }

  // Speed matters at the counter: JPEG encodes several times faster than WebP in the browser,
  // and the server turns the upload into a ~200 KB WebP anyway. So: at most 3 quick passes, each
  // one sized from the result of the previous one instead of blindly trying every quality.
  let scale = Math.min(1, maxDimension / Math.max(srcW, srcH))
  let quality = 0.8
  let best: Blob | null = null

  for (let pass = 0; pass < 3; pass++) {
    const canvas = document.createElement("canvas")
    canvas.width  = Math.max(1, Math.round(srcW * scale))
    canvas.height = Math.max(1, Math.round(srcH * scale))
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("المتصفح لا يدعم معالجة الصور")
    ctx.fillStyle = "#ffffff"          // transparent PNGs become white instead of black in JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await canvasToBlob(canvas, "image/jpeg", quality)
    if (!blob) break
    if (!best || blob.size < best.size) best = blob
    if (blob.size <= maxBytes) break

    // too big by a factor f: lower the quality a little and the pixel count by the rest
    const f = blob.size / maxBytes
    quality = Math.max(0.5, quality - 0.12)
    scale *= Math.max(0.45, Math.min(0.9, 1 / Math.sqrt(f * 0.8)))
  }

  if ("close" in bitmap) bitmap.close()
  if (!best) throw new Error("تعذر ضغط الصورة")

  const ext = best.type === "image/webp" ? "webp" : "jpg"
  const base = file.name.replace(/\.[^.]+$/, "") || "photo"
  return new File([best], `${base}.${ext}`, { type: best.type })
}
