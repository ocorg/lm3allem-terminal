import { withModule }          from "@/lib/auth/session"
import {
  getCostumeItems,
  getInventoryLookups,
} from "@/lib/actions/costumes/inventory"
import { CostumesInventoryClient } from "@/components/costumes/inventory/CostumesInventoryClient"
import React from "react"

export default async function RentalInventoryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params
  const authSession = await withModule("costumes", "rental_inventory")

  const [items, { suitSizes, pantsSizes, shirtSizes, shoeSizes, costumeTypes, lookupById }] =
    await Promise.all([
      getCostumeItems(),
      getInventoryLookups(),
    ])

  return (
    <CostumesInventoryClient
      items={items}
      suitSizes={suitSizes}
      pantsSizes={pantsSizes}
      shirtSizes={shirtSizes}
      shoeSizes={shoeSizes}
      costumeTypes={costumeTypes}
      lookupById={lookupById}
      role={authSession.user.role}
    />
  )
}