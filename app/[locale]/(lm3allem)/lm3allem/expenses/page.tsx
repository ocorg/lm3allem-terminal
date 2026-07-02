import { getExpenses } from "@/lib/actions/lm3allem/expenses"
import { getLookupCategories, getLookupValues } from "@/lib/actions/lm3allem/options"
import { ExpensesClient } from "@/components/lm3allem/expenses/ExpensesClient"
import React from "react"

export default async function ExpensesPage() {
  const [expenses, categories] = await Promise.all([
    getExpenses(),
    getLookupCategories(),
  ])
  const expenseCat = categories.find((c) => c.slug === "expense_categories")
  const expenseValues = expenseCat ? await getLookupValues(expenseCat.id) : []
  return (
    <ExpensesClient
      initialExpenses={expenses}
      categories={categories}
      expenseValues={expenseValues}
    />
  )
}