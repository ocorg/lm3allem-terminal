import { getLookupCategories } from "@/lib/actions/lm3allem/options"
import { OptionsClient } from "@/components/lm3allem/options/OptionsClient"

export default async function OptionsPage() {
  const categories = await getLookupCategories()
  return <OptionsClient categories={categories} />
}