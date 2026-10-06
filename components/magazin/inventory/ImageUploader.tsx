"use client"

import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Upload, X, ImageIcon } from "lucide-react"
import { toast } from "@/hooks/useToast"
import { compressImage } from "@/lib/client/image-compress"
import React from "react"

interface ImageUploaderProps {
  images:   string[]
  onChange: (images: string[]) => void
  /** "guarantee" documents go to the private store and are served through an authenticated route */
  uploadType?: "product-image" | "guarantee"
  /** The field title. Pass `false` when the surrounding form already shows one (no duplicate labels). */
  label?: string | false
  /** Only one image allowed (new upload replaces the previous one) */
  single?: boolean
}

export function ImageUploader({ images, onChange, uploadType = "product-image", label, single = false }: ImageUploaderProps) {
  const t = useTranslations("magazin.inventory")
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<"idle" | "compressing" | "uploading">("idle")

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const list = single ? [files[0]] : Array.from(files)
    const newUrls: string[] = []

    for (const original of list) {
      try {
        // Photos are shrunk to ~200 KB in the browser first: faster upload, far less storage used
        setStatus("compressing")
        const file = await compressImage(original, { maxBytes: 400 * 1024, maxDimension: uploadType === "guarantee" ? 1800 : 1600 })

        setStatus("uploading")
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch(`/api/upload/${uploadType}`, { method: "POST", body: fd, signal: AbortSignal.timeout(45_000) })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "" }))
          throw new Error(err.error || "فشل رفع الصورة")
        }
        const { url } = await res.json()
        newUrls.push(url as string)
      } catch (e) {
        const timedOut = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")
        toast(
          timedOut
            ? "استغرق رفع الصورة وقتا طويلا. تحقق من الاتصال بالإنترنت ثم أعد المحاولة"
            : (e instanceof Error && e.message) || t("uploadError"),
          "error"
        )
      }
    }

    if (newUrls.length) onChange(single ? newUrls.slice(-1) : [...images, ...newUrls])
    setStatus("idle")
  }

  const busy = status !== "idle"
  const title = label === undefined ? t("imagesLabel") : label

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {title !== false && (
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
          {title}
        </span>
      )}

      {/* Thumbnails */}
      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {images.map((url, idx) => (
            <div key={idx} style={{ position: "relative", width: 72, height: 72 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, i) => i !== idx))}
                aria-label="حذف الصورة"
                style={{
                  position:     "absolute",
                  top:          -8,
                  insetInlineEnd: -8,
                  background:   "var(--brand-red)",
                  border:       "none",
                  borderRadius: "50%",
                  width:        28,
                  height:       28,
                  cursor:       "pointer",
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} style={{ color: "#fff" }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload trigger */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          8,
          padding:      "10px 14px",
          background:   "var(--surface-2)",
          border:       "1px dashed var(--border)",
          borderRadius: 8,
          cursor:       busy ? "wait" : "pointer",
          color:        "var(--text-muted)",
          fontSize:     12,
          fontWeight:   500,
          opacity:      busy ? 0.7 : 1,
        }}
      >
        {busy ? <Upload size={14} /> : <ImageIcon size={14} />}
        {status === "compressing" ? "جارٍ تصغير الصورة..." : status === "uploading" ? t("uploading") : t("addImages")}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple={!single}
        style={{ display: "none" }}
        onChange={e => { handleFiles(e.target.files); e.target.value = "" }}
      />
    </div>
  )
}
