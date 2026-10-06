const numberFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })

/**
 * Amount in dirhams, written the same way everywhere: "1 550,00 درهم".
 * Built by hand (not with a locale currency style) so the server and every browser print exactly
 * the same characters, with a normal space that wraps and aligns predictably.
 */
export function formatMAD(amount: number | string | { toString(): string }): string {
  const num = parseFloat(amount.toString())
  if (isNaN(num)) return "- درهم"
  return `${formatNumber(num)} درهم`
}

/**
 * "1 550,00" (space for thousands, comma for decimals, as used in Morocco).
 * The space is a NO-BREAK space on purpose: in right-to-left text a normal space would split the
 * number in two and show its halves in the wrong order ("550,00 1").
 */
export function formatNumber(num: number): string {
  const text = numberFmt.format(Math.abs(num)).replace(/,/g, "\u00A0").replace(".", ",")
  return num < 0 ? signed("-", text) : text
}

/**
 * A sign stays glued to the LEFT of its number ("+270,00", "-50,00") even inside right-to-left
 * text: the pair is wrapped in a left-to-right isolate, otherwise it would show as "270,00+".
 */
function signed(sign: string, digits: string): string {
  return `\u2066${sign}${digits}\u2069`
}

/** Amount with an explicit sign: "+270,00 درهم" for money in, "-50,00 درهم" for money out. */
export function formatSignedMAD(amount: number | string | { toString(): string }, opts: { plus?: boolean } = {}): string {
  const num = parseFloat(amount.toString())
  if (isNaN(num)) return "- درهم"
  if (num < 0) return formatMAD(num)
  return opts.plus === false || num === 0 ? formatMAD(num) : `${signed("+", formatNumber(num))} درهم`
}
