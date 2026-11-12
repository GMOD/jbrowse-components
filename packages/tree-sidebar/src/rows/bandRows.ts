import { groupKeyComparator } from '@jbrowse/core/util/groupKeys'

/** A band of the rows as drawn: its value, its label and the rows it spans. */
export interface RowBand {
  key: string
  label: string
  start: number
  /** exclusive, so `end - start` is the band's row count */
  end: number
}

/** What bands a display's rows: the attribute read and the bands listed first. */
export interface RowBanding {
  field: string
  sort: readonly string[]
}

/**
 * The rows stacked by band, each band's rows in the order they arrived in,
 * the bands in `domain` order and the rest sorted with the `''` band last,
 * and the span each band takes. No bands, and `rows` itself, while no row
 * carries a band value; `rows` itself too while the bands already stack.
 */
export function bandRows<S>(
  rows: S[],
  bandOf: (row: S) => string,
  banding: RowBanding,
): { rows: S[]; bands: RowBand[] } {
  const keys = rows.map(bandOf)
  if (!keys.some(key => key !== '')) {
    return { rows, bands: [] }
  }
  const counts = new Map<string, number>()
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const ordered = [...counts.keys()].sort(groupKeyComparator(banding.sort))
  const starts = new Map<string, number>()
  const bands: RowBand[] = []
  let at = 0
  for (const key of ordered) {
    const end = at + counts.get(key)!
    starts.set(key, at)
    bands.push({
      key,
      label: key === '' ? `(no ${banding.field})` : key,
      start: at,
      end,
    })
    at = end
  }
  const out = new Array<S>(rows.length)
  let moved = false
  for (let i = 0; i < rows.length; i++) {
    const slot = starts.get(keys[i]!)!
    starts.set(keys[i]!, slot + 1)
    out[slot] = rows[i]!
    moved ||= slot !== i
  }
  return { rows: moved ? out : rows, bands }
}
