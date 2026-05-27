import { set1 } from '@jbrowse/core/ui/colors'
import { randomColor } from '@jbrowse/core/util/color'

// Pick a color per row by some metadata attribute. Less-common values get
// the first set1 entries (most visually distinct); when set1 runs out (>9
// distinct values) fall back to a deterministic random color seeded by the
// value so repeated palette-bys produce stable results.
export function applyColorPalette<S extends { name: string; color?: string }>(
  sources: S[],
  attribute: string,
): (S & { color: string })[] {
  if (!attribute || !sources.length) {
    return sources
  }
  if (!sources.some(s => attribute in s)) {
    return sources
  }
  const keys = sources.map(s => String((s as Record<string, unknown>)[attribute] ?? ''))
  const counts = new Map<string, number>()
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const colorByValue = Object.fromEntries(
    [...counts.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([key], idx) => [key, set1[idx] ?? randomColor(key)]),
  )
  return sources.map((s, i) => ({ ...s, color: colorByValue[keys[i]!] }))
}
