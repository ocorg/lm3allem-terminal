import { redirect } from "next/navigation"

export default async function LmaallemRootPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(`/${locale}/lm3allem/dashboard`)
}