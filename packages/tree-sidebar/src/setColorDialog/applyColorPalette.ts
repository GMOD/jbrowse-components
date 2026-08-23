import { categoricalPalette } from '@jbrowse/core/ui/colors'
import { randomColor } from '@jbrowse/core/util/color'

export type Colored<T> = T & { color: string }

// Pick a color per row by some metadata attribute, index-aligned with
// `sources`. Most-common values get the first (most visually distinct)
// `categoricalPalette` entries; when it runs out (>~40 distinct values) fall
// back to a deterministic random color seeded by the value so repeated
// palette-bys produce stable results.
//
// Returns the colors rather than applying them so callers can target a field
// other than `color` (the dialog paints whichever color column is active).
export function paletteColorsByRow<S extends { name: string }>(
  sources: S[],
  attribute: string,
): string[] {
  // Use 'name' as fallback attribute if attribute is empty or doesn't exist in any source
  const finalAttr =
    attribute && sources.some(s => attribute in s) ? attribute : 'name'

  const keys = sources.map(s => {
    const record: Record<string, unknown> = s
    return String(record[finalAttr] ?? '')
  })
  const counts = new Map<string, number>()
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const colorByValue: Record<string, string> = Object.fromEntries(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key], idx) => [key, categoricalPalette[idx] ?? randomColor(key)]),
  )

  return keys.map(key => colorByValue[key]!)
}

// Assign a categorical palette to each row's `color`.
export function applyColorPalette<S extends { name: string; color?: string }>(
  sources: S[],
  attribute: string,
): Colored<S>[] {
  const colors = paletteColorsByRow(sources, attribute)
  return sources.map((s, i) => ({
    ...s,
    color: colors[i]!,
  }))
}
