import { NextRequest, NextResponse } from "next/server"
import { auth }                      from "@/lib/auth/auth"
import { uploadToR2, buildR2Key }    from "@/lib/r2/upload"

const ALLOWED_UPLOAD_TYPES = ["product-image", "guarantee"] as const
type UploadType = (typeof ALLOWED_UPLOAD_TYPES)[number]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  // Auth check
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type } = await params
  if (!ALLOWED_UPLOAD_TYPES.includes(type as UploadType)) {
    return NextResponse.json(
      { error: `Type d'upload invalide. Valeurs acceptées : ${ALLOWED_UPLOAD_TYPES.join(", ")}` },
      { status: 400 }
    )
  }

  // Parse multipart form
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const key    = buildR2Key(type, file.name)

  try {
    const result = await uploadToR2(buffer, key, file.type, file.size)
    return NextResponse.json({ url: result.url, key: result.key })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur d'upload"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}