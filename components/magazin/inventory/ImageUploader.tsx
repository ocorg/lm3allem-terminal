"use client"

import { useRef, useState } from "react"
import { Upload, X, ImageIcon } from "lucide-react"
import { toast } from "@/hooks/useToast"

interface ImageUploaderProps {
  images:   string[]
  onChange: (images: string[]) => void
}

export function ImageUploader({ images, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    const newUrls: string[] = []

    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append("file", file)
      try {
        const res = await fetch("/api/upload/product-image", { method: "POST", body: fd })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }))
          throw new Error(err.error ?? "Upload failed")
        }
        const { url } = await res.json()
        newUrls.push(url as string)
      } catch (e) {
        toast(e instanceof Error ? e.message : "Erreur lors de l'upload", "error")
      }
    }

    if (newUrls.length) onChange([...images, ...newUrls])
    setUploading(false)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Images
      </span>

      {/* Thumbnails */}
      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {images.map((url, idx) => (
            <div key={idx} style={{ position: "relative", width: 72, height: 72 }}>
              <img
                src={url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <button
                onClick={() => onChange(images.filter((_, i) => i !== idx))}
                style={{
                  position:     "absolute",
                  top:          -6,
                  insetInlineEnd: -6,
                  background:   "var(--danger)",
                  border:       "none",
                  borderRadius: "50%",
                  width:        20,
                  height:       20,
                  cursor:       "pointer",
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "center",
                }}
              >
                <X size={11} style={{ color: "#fff" }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload trigger */}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          8,
          padding:      "10px 14px",
          background:   "var(--surface-2)",
          border:       "1px dashed var(--border)",
          borderRadius: 8,
          cursor:       uploading ? "wait" : "pointer",
          color:        "var(--text-muted)",
          fontSize:     12,
          fontWeight:   500,
          opacity:      uploading ? 0.6 : 1,
        }}
      >
        {uploading ? <Upload size={14} /> : <ImageIcon size={14} />}
        {uploading ? "Téléchargement en cours..." : "Ajouter des images"}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: "none" }}
        onChange={e => { handleFiles(e.target.files); e.target.value = "" }}
      />
    </div>
  )
}