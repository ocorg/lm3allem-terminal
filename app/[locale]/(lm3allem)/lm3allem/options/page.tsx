import { getLookupCategories } from "@/lib/actions/lm3allem/options"
import { OptionsClient } from "@/components/lm3allem/options/OptionsClient"

export default async function OptionsPage() {
  let categories: Awaited<ReturnType<typeof getLookupCategories>>
  try { categories = await getLookupCategories() } catch { categories = [] }
  return <OptionsClient categories={categories} />
}
