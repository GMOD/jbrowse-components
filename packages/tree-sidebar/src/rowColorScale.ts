import { dealRowColors } from '@jbrowse/display-kit/colorConfigSchema'

/**
 * What a display's row palette deals: the values in the order they take
 * colours, the value each row takes its colour by (undefined for a row the
 * palette skips), and `dealRowColors`' entries and palette.
 */
export interface RowColorDeal<S> {
  order: readonly string[]
  valueOf: (row: S) => string | undefined
  domain: readonly string[]
  range: readonly string[]
  palette: readonly string[]
}

const NONE: ReadonlyMap<string, string> = new Map()

/** The colour `deal` gives each value it deals. */
export function dealtColors<S>(
  deal: RowColorDeal<S> | undefined,
): ReadonlyMap<string, string> {
  return deal ? dealRowColors(deal.order, deal, deal.palette) : NONE
}

/** The colour each of `rows` takes by its value in `dealt`, by row name. */
export function colorsByRow<S extends { name: string }>(
  rows: readonly S[],
  deal: RowColorDeal<S> | undefined,
  dealt: ReadonlyMap<string, string>,
): ReadonlyMap<string, string> {
  if (!deal) {
    return NONE
  }
  const byName = new Map<string, string>()
  for (const row of rows) {
    const value = deal.valueOf(row)
    const color = value === undefined ? undefined : dealt.get(value)
    if (color !== undefined) {
      byName.set(row.name, color)
    }
  }
  return byName
}

/** The colour `deal` gives each of `rows`, by row name. */
export function rowColorScale<S extends { name: string }>(
  rows: readonly S[],
  deal: RowColorDeal<S> | undefined,
): ReadonlyMap<string, string> {
  return colorsByRow(rows, deal, dealtColors(deal))
}

/** `field`'s value on `row`, `''` where the row has none of its own. */
export function rowFieldValue(row: object, field: string) {
  const value: unknown = Object.hasOwn(row, field)
    ? Reflect.get(row, field)
    : undefined
  return value === undefined || value === null ? '' : String(value)
}

/** The distinct `values`, the most frequent first and ties first seen first. */
export function valuesByCount(values: readonly string[]) {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v)
}
