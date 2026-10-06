import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/guard"
import { canAccessModule } from "@/lib/permissions"
import { getPrivateObject } from "@/lib/r2/upload"

/**
 * Authenticated gateway for private files (rental guarantee documents).
 * The bucket itself is never exposed; only logged-in users who may manage rentals can read a file.
 */
export const dynamic = "force-dynamic"

const KEY_RE = /^guarantee\/[A-Za-z0-9._-]{8,120}$/

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const user = await getCurrentUser()
  if (!user || user.mustChangePassword) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canAccessModule(user, "costumes", "rentals")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const key = (await params).key.join("/")
  if (!KEY_RE.test(key)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const object = await getPrivateObject(key)
    if (!object.Body) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const bytes = await object.Body.transformToByteArray()
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type":           object.ContentType ?? "application/octet-stream",
        "Cache-Control":          "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition":    "inline",
      },
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
