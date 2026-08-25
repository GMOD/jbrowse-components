import { categoricalPalette } from '@jbrowse/core/ui/colors'
import { randomColor } from '@jbrowse/core/util/color'

// Pick a color per row by some metadata attribute, index-aligned with
// `sources`. Most-common values get the first (most visually distinct)
// `categoricalPalette` entries; when it runs out (>~40 distinct values) fall
// back to a deterministic random color seeded by the value so repeated
// palette-bys produce stable results.
//
// Returns the colors rather than applying them so callers target whichever
// color channel they paint — the dialog's active column, a display's row tint
// (`labelColor`).
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
