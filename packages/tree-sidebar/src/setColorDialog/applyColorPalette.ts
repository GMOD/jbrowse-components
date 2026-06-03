import { paletteColors } from '@jbrowse/core/ui/colors'
import { randomColor } from '@jbrowse/core/util/color'

export type Colored<T> = T & { color: string }

// A wide qualitative palette built from several distinct-hue schemes, deduped.
// ~40 entries so categorical attributes with many values (e.g. the 26 1000
// Genomes population codes) all get a curated color instead of falling back to
// grey/random. tableau10 leads because its hues are the most evenly separated.
const { tableau10, set1, dark2, set2, category10 } = paletteColors
const PALETTE = [
  ...new Set([...tableau10, ...set1, ...dark2, ...set2, ...category10]),
]

// Pick a color per row by some metadata attribute. Most-common values get the
// first (most visually distinct) palette entries; when the palette runs out
// (>~40 distinct values) fall back to a deterministic random color seeded by
// the value so repeated palette-bys produce stable results.
export function applyColorPalette<S extends { name: string; color?: string }>(
  sources: S[],
  attribute: string,
): Colored<S>[] {
  if (sources.length === 0) {
    return []
  }

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
      .map(([key], idx) => [key, PALETTE[idx] ?? randomColor(key)]),
  )

  return sources.map((s, i) => ({
    ...s,
    color: colorByValue[keys[i]!]!,
  }))
}
