import { redirect }     from "next/navigation"

export default async function MagazinPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(`/${locale}/magazin/pos`)
}