import { getQueryColor, hashString } from '@jbrowse/core/ui/colors'
import { tagColorPalette } from '@jbrowse/core/ui/palette'

import type { ColorBy } from '../shared/types.ts'

export const TAG_COLOR_PALETTE = tagColorPalette

// Palette slot for a tag value, derived from the VALUE rather than from the
// order it was discovered in. Values stream in as regions load, so
// discovery-order slots meant a track's colors depended on which read happened
// to arrive first: HP:1 could paint blue in one session and pink in the next,
// and a figure wasn't reproducible from its session file.
//
// A non-negative integer indexes the palette anchored at 1, so HP:1 takes the
// leading blue and HP:2 the pink — every tool that writes the tag (whatshap,
// HiPhase, Clair3, longshot, PEPPER-margin) numbers haplotypes from 1, and
// indexing straight through instead left the first haplotype pink and the second
// green. HP:0 means unphased where it appears at all, and lands at the far end of
// the palette rather than sharing the leading color with a real haplotype.
// Adjacent haplotypes stay adjacent and distinct, and discovering a new value
// never shifts an existing one. Anything else hashes — stable for the same
// reason, at the cost of occasional collisions between two values; discovery
// order had those too, since it wrapped at the palette length.
function tagValueColor(value: string) {
  const n = TAG_COLOR_PALETTE.length
  const num = Number(value)
  const idx =
    Number.isInteger(num) && num >= 0 ? num + n - 1 : hashString(value)
  return TAG_COLOR_PALETTE[idx % n]!
}

/**
 * The color one CPU-baked value paints, for whichever scheme is active. The
 * paint path (`buildReadTagColors`) and the legend's swatch list both resolve
 * through this, so a swatch is the color drawn by construction.
 *
 * A pure function of the value, which is what lets the display hold no
 * discovered-value map at all. There used to be one — `colorTagMap`, a volatile
 * the fetch added to — and every rule around it existed to manage the cache
 * rather than to decide a color: clear it when the scheme changes, do NOT clear
 * it when the scheme is merely re-picked, assign only when a value was actually
 * added or every already-loaded region rebakes, and narrow it at the legend
 * because it never shrank on navigation. All four are gone with the map. The
 * colors are unchanged: this is the same pair of functions the map's entries
 * were filled from.
 *
 * Chromosome painting hashes through `getQueryColor` — the same one the synteny
 * view's Query mode uses — and a tag value takes a palette slot. Both are
 * stable across sessions, so a figure is reproducible from its session file.
 */
export function bakedValueColor(colorBy: ColorBy, value: string) {
  return colorBy.type === 'mateRefName'
    ? getQueryColor(value)
    : tagValueColor(value)
}
