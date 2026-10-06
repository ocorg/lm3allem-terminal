import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/guard"
import { isAdminRole } from "@/lib/permissions"
import { getPusherServer } from "@/lib/pusher/server"

/** Only the admin notification channel exists; only admins (and the ghost account) may subscribe. */
const ALLOWED_CHANNEL = "private-lm3allem-notifications"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.mustChangePassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body         = await req.text()
  const params       = new URLSearchParams(body)
  const socketId     = params.get("socket_id")    ?? ""
  const channelName  = params.get("channel_name") ?? ""

  if (channelName !== ALLOWED_CHANNEL || !/^[\d.]+$/.test(socketId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const authResponse = getPusherServer().authorizeChannel(socketId, channelName)
  return NextResponse.json(authResponse)
}
