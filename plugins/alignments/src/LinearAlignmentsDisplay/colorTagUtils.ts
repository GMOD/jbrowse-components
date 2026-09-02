import { hashString, refNameColor } from '@jbrowse/core/ui/colors'
import { tagColorPalette } from '@jbrowse/core/ui/palette'
import { relight } from '@jbrowse/core/util/color'

import type { ColorBy } from '../shared/types.ts'

/**
 * Where a refName sits in its assembly's own chromosome order, for chromosome
 * painting — the display's `paintedRefNamePosition`, which canonicalizes the
 * name first because a mate reference arrives in the FILE's spelling. Undefined
 * for every other scheme, and while the assembly is still loading, where
 * `refNameColor` falls back to its hash.
 */
export type RefNamePosition = (refName: string) => number | undefined

// Each lap around the palette re-lights the same ten hues, giving a hashed value
// 30 positions to land in. Laps only darken: tol_light has no room to go lighter
// against the track background.
const TAG_PALETTE_LAP_TONES = [
  undefined,
  { lightnessShift: -0.18, chromaScale: 1.35 },
  { lightnessShift: -0.36, chromaScale: 1.7 },
]

const TAG_PALETTE_POSITIONS =
  tagColorPalette.length * TAG_PALETTE_LAP_TONES.length

function tagPaletteColorAt(position: number) {
  const hex = tagColorPalette[position % tagColorPalette.length]!
  const lap =
    TAG_PALETTE_LAP_TONES[
      Math.floor(position / tagColorPalette.length) %
        TAG_PALETTE_LAP_TONES.length
    ]
  return lap ? relight(hex, lap.lightnessShift, lap.chromaScale) : hex
}

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
// never shifts an existing one. The integer branch stays on the ten base slots,
// where adjacency is the point; anything else hashes into the lap-extended
// positions, stable for the same reason at the cost of occasional collisions.
function tagValueColor(value: string) {
  const n = tagColorPalette.length
  const num = Number(value)
  return Number.isInteger(num) && num >= 0
    ? tagColorPalette[(num + n - 1) % n]!
    : tagPaletteColorAt(hashString(value) % TAG_PALETTE_POSITIONS)
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
 * Chromosome painting goes through `refNameColor` — the same rule and the same
 * palette the synteny and dotplot views paint a query contig with, so one contig
 * takes one color wherever it is drawn. A tag value takes a palette slot. Both
 * are stable across sessions, so a figure is reproducible from its session file.
 *
 * `refNamePosition` is what makes the chromosome case hand the palette out
 * rather than hash into it. It used to hash unconditionally (`getQueryColor`),
 * which on hg38 painted chr1, chr12, chr21 and chrY one color and left every
 * other human chromosome sharing with at least one more — so from a chr1 view a
 * translocation to chr12 was invisible against the reads around it. Synteny had
 * already been moved off the hash for the same collision on rice; the comment
 * here claiming the two matched was written before that.
 */
export function bakedValueColor(
  colorBy: ColorBy,
  value: string,
  refNamePosition?: RefNamePosition,
) {
  return colorBy.type === 'mateRefName'
    ? refNameColor(value, refNamePosition?.(value))
    : tagValueColor(value)
}
