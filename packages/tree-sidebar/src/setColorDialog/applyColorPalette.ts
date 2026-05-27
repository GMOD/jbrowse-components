import { set1 } from '@jbrowse/core/ui/colors'
import { randomColor } from '@jbrowse/core/util/color'

export type Colored<T> = T & { color: string }

// Pick a color per row by some metadata attribute. Less-common values get
// the first set1 entries (most visually distinct); when set1 runs out (>9
// distinct values) fall back to a deterministic random color seeded by the
// value so repeated palette-bys produce stable results.
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
      .sort((a, b) => a[1] - b[1])
      .map(([key], idx) => [key, set1[idx] ?? randomColor(key)]),
  )

  return sources.map((s, i) => ({
    ...s,
    color: colorByValue[keys[i]!]!,
  }))
}
