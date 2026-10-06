import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/guard"
import { canAccessModule, isAdminRole } from "@/lib/permissions"
import { assertUploadSize, uploadImage, type UploadKind } from "@/lib/r2/upload"
import { checkMaintenanceMode } from "@/lib/utils/maintenance"

const ALLOWED_UPLOAD_TYPES: UploadKind[] = ["product-image", "guarantee"]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const user = await getCurrentUser()
  if (!user || user.mustChangePassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type } = await params
  if (!ALLOWED_UPLOAD_TYPES.includes(type as UploadKind)) {
    return NextResponse.json({ error: "نوع الرفع غير صالح" }, { status: 400 })
  }
  const kind = type as UploadKind

  // Product photos: whoever may manage an inventory (the same people who can save the product).
  // Guarantee documents: anyone who can create rentals.
  const allowed = kind === "product-image"
    ? isAdminRole(user.role) || canAccessModule(user, "magazin", "inventory") || canAccessModule(user, "costumes", "rental_inventory")
    : canAccessModule(user, "costumes", "rentals")
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (user.role === "staff" && (await checkMaintenanceMode()).isActive) {
    return NextResponse.json({ error: "النظام في وضع الصيانة" }, { status: 503 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "لم يتم اختيار ملف" }, { status: 400 })
  }

  try {
    assertUploadSize(file.size)
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadImage(buffer, kind)
    return NextResponse.json({ url: result.url, key: result.key })
  } catch (err) {
    const message = err instanceof Error ? err.message : "فشل الرفع"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
