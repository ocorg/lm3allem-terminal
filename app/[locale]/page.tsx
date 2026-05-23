import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import PinEntryScreen from "@/components/ui/PinEntryScreen"
import { getInitialLockoutState } from "@/lib/auth/pin-lockout"
import type { Portal } from "@prisma/client"

export default async function PinPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const session = await auth()

  if (session?.user) {
    const { role, portalAccess } = session.user
    if (role === "superadmin" || role === "admin") {
      redirect(`/${locale}/select-portal`)
    }
    if (portalAccess.length === 1) {
      redirect(`/${locale}/${portalAccess[0] as Portal}`)
    }
    redirect(`/${locale}/select-portal`)
  }

  const lockState = await getInitialLockoutState()
  return <PinEntryScreen locale={locale} initialLockState={lockState} />
}