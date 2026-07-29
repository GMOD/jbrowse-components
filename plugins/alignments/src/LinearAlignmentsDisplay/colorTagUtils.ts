import { getQueryColor, hashString } from '@jbrowse/core/ui/colors'
import { tagColorPalette } from '@jbrowse/core/ui/theme'

export const TAG_COLOR_PALETTE = tagColorPalette

// Add any not-yet-seen value to the discovered value -> painted color map.
// Object.hasOwn, not `!map[value]`: a tag value like 'toString' or 'constructor'
// inherits a truthy value off Object.prototype, so the truthiness check would
// skip assigning it a color and leave the read on the no-tag fallback.
function addValues(
  currentMap: Record<string, string>,
  values: string[],
  colorFor: (value: string) => string,
) {
  const map = { ...currentMap }
  let added = false
  for (const value of values) {
    if (!Object.hasOwn(map, value)) {
      map[value] = colorFor(value)
      added = true
    }
  }
  return { map, added }
}

// Palette slot for a tag value, derived from the VALUE rather than from the
// order it was discovered in. Values stream in as regions load, so
// discovery-order slots meant a track's colors depended on which read happened
// to arrive first: HP:1 could paint blue in one session and pink in the next,
// and a figure wasn't reproducible from its session file.
//
// A non-negative integer indexes the palette directly. Haplotype tags are
// written both 0/1 and 1/2 in the wild, and indexing straight through puts both
// conventions on the palette's leading colors with no wraparound; anchoring at 1
// instead would send HP:0 to the far end of the palette. Adjacent haplotypes stay
// adjacent and distinct, and discovering a new value never shifts an existing
// one. Anything else hashes — stable for the same reason, at the cost of
// occasional collisions between two values; discovery order had those too, since
// it wrapped at the palette length.
function tagValueColor(value: string) {
  const num = Number(value)
  const idx = Number.isInteger(num) && num >= 0 ? num : hashString(value)
  return TAG_COLOR_PALETTE[idx % TAG_COLOR_PALETTE.length]!
}

// Color by tag: each value's color is a pure function of the value, so the same
// tag paints the same way every session.
export function updateColorTagMap(
  currentMap: Record<string, string>,
  tags: string[],
) {
  return addValues(currentMap, tags, tagValueColor)
}

// Chromosome painting (colorBy 'mateRefName'): each name hashes to its own
// stable color through the same `getQueryColor` that `buildReadTagColors` bakes
// into the reads and the synteny view uses for its Query mode, so the legend
// swatch is the color painted.
export function updateQueryNameColorMap(
  currentMap: Record<string, string>,
  names: string[],
) {
  return addValues(currentMap, names, getQueryColor)
}
