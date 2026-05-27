import { redirect } from "next/navigation"

export default async function CostumesIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(`/${locale}/costumes/pos`)
}