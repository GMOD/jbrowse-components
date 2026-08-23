import { relight } from '../util/color/index.ts'

const category10 = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
]
const dark2 = [
  '#1b9e77',
  '#d95f02',
  '#7570b3',
  '#e7298a',
  '#66a61e',
  '#e6ab02',
  '#a6761d',
  '#666666',
]
const set1 = [
  '#377eb8',
  '#e41a1c',
  '#4daf4a',
  '#984ea3',
  '#ff7f00',
  '#ffff33',
  '#a65628',
  '#f781bf',
  '#999999',
]
const set2 = [
  '#66c2a5',
  '#fc8d62',
  '#8da0cb',
  '#e78ac3',
  '#a6d854',
  '#ffd92f',
  '#e5c494',
  '#b3b3b3',
]
const tableau10 = [
  '#4e79a7',
  '#f28e2c',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc949',
  '#af7aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ab',
]

const ggplot2Colors6 = [
  '#F8766D',
  '#B79F00',
  '#00BA38',
  '#00BFC4',
  '#619CFF',
  '#F564E3',
]

const ggplot2Colors5 = ['#F8766D', '#A3A500', '#00BF7D', '#00B0F6', '#E76BF3']
const ggplot2Colors4 = ['#F8766D', '#7CAE00', '#00BFC4', '#C77CFF']
const ggplot2Colors3 = ['#F8766D', '#00BA38', '#619CFF']

// A neutral has no place in a categorical palette that paints FILLS. Grey reads
// as "uncolored / no value" — it is what `randomColor` hands a value-less
// feature, what a synteny ribbon defaults to, what alignments paint a read with
// no tag — so a category landing on one says the opposite of what the palette
// is for. `refNameColorHexes` below drops category10's grey for this reason and
// has since it was written; this is the same rule applied to every scheme at
// once.
const NEUTRALS = new Set([
  '#bab0ab',
  '#999999',
  '#666666',
  '#b3b3b3',
  '#7f7f7f',
])

export const paletteColors = {
  category10,
  dark2,
  ggplot2Colors3,
  ggplot2Colors4,
  ggplot2Colors5,
  ggplot2Colors6,
  set1,
  set2,
  tableau10,
}

/**
 * The wide qualitative palette: every scheme above, in order, deduped and with
 * the neutrals dropped. ~40 entries.
 *
 * One list, because "give each row a distinct color" is one question this repo
 * answers in two places — the multi-row painter handing colors out by row
 * index, and the arrangement dialog's palette-by-attribute — and two lists
 * would mean a track's automatic colors and the colors it takes when a user
 * palettes it by hand were different palettes for no reason a reader could see.
 *
 * `tableau10` leads because its hues are the most evenly separated, so a track
 * with a handful of rows spends only that. The tail is what makes the 26
 * 1000-Genomes population codes, or a repeat painting's classes, all get a
 * curated color instead of falling out to `randomColor`.
 *
 * Past the end is the caller's problem, and the two callers answer differently
 * on purpose: an attribute palette-by hashes the VALUE (stable across
 * re-palettes), while a by-position painter has no value to hash and wraps.
 */
export const categoricalPalette = [
  ...new Set(
    [...tableau10, ...set1, ...dark2, ...set2, ...category10].filter(
      hex => !NEUTRALS.has(hex.toLowerCase()),
    ),
  ),
]

// only category10 and set1 are imported by name; the rest are reached through
// paletteColors above
/**
 * Deterministic non-negative 32-bit hash of a string.
 */
export function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Stable category10 color for a sequence name, via `hashString`.
 *
 * Kept as a published export; in-tree, prefer {@link refNameColor}, which hands
 * the palette out by position where the caller knows the assembly's chromosome
 * order and only hashes where it does not.
 */
export function getQueryColor(queryName: string) {
  return category10[hashString(queryName) % category10.length]!
}

// The by-refName painting palette: category10 with its grey dropped, since a
// grey chromosome reads as "uncolored/broken" (see NEUTRALS).
//
// category10 rather than the wide `categoricalPalette` — a karyotype wants nine
// hues it can re-light into tones a reader can compare, not forty unrelated
// ones, and `PALETTE_LAP_TONES` below is what that costs.
const refNameColorHexes = category10.filter(hex => !NEUTRALS.has(hex))

// Nine do not cover a karyotype, so each LAP around the list re-lights the same
// hues: chromosome 10 is a deep version of chromosome 1's blue, chromosome 19 a
// pale one. Three laps is 27 colors, past every karyotype these figures anchor
// on (human 24, rice 12, bread wheat 21), and a fourth lap starts the tones
// again rather than fading to nothing — a repeat 27 positions away is one no
// reader is comparing.
//
// THE COLORS ARE THE PALETTE'S, not a ramp's. This spent a round as the next hue
// on the golden angle at a fixed HSL 70%/50%, which is collision-free for any
// karyotype and was rejected on sight by figure review ("the previous palette is
// better"): an even hue circle at one saturation is a rainbow, and a five-genome
// synteny figure drawn in one is a hundred thousand ribbons of pure red, green,
// blue and magenta. category10's nine are uneven on purpose — that is what makes
// them read as a set.
//
// It is not the weaker option for distinguishability either, which is what the
// ramp was reached for. Closest pair in OKLab over 24 positions: 0.077 for these
// laps, 0.019 for the golden angle at HSL 70%/50% — an even hue circle is even
// in HSL's hue, and HSL's hue is not perceptually even.
const PALETTE_LAP_TONES = [
  // lap 0 is the palette color itself, untouched
  undefined,
  // deep before pale, because these are drawn at a low alpha over white (the
  // OrthoFinder figures run at 0.06) and a pale color at 0.06 is a color a
  // reader cannot see. Chroma held, and the gamut takes what it must down here.
  { lightnessShift: -0.17, chromaScale: 1 },
  // pale. Chroma comes down with lightness: held at full, the light lap's reds
  // and pinks all pin against the top of the sRGB gamut and converge there.
  { lightnessShift: 0.18, chromaScale: 0.8 },
]

/** The palette color for a chromosome at `position` in its assembly. */
export function refNamePaletteColorAt(position: number) {
  const hex = refNameColorHexes[position % refNameColorHexes.length]!
  const lap =
    PALETTE_LAP_TONES[
      Math.floor(position / refNameColorHexes.length) % PALETTE_LAP_TONES.length
    ]
  return lap ? relight(hex, lap.lightnessShift, lap.chromaScale) : hex
}

/**
 * The color a refName paints, BY POSITION IN THE ASSEMBLY where the caller
 * knows its chromosome order.
 *
 * Handing the palette out rather than hashing into it is what stops a genome
 * painting two of its own chromosomes the same color: nine slots means ten or
 * more chromosomes re-use one, and by the birthday bound long before that. On
 * hg38 the hash puts chr1, chr12, chr21 and chrY on one color.
 *
 * `position` is undefined for the case the order genuinely is not available —
 * an assembly still loading, or a refName the assembly does not list (a
 * scaffold under an alias). There a stable arbitrary color beats no color, so
 * it falls back to the hash.
 */
export function refNameColor(name: string, position: number | undefined) {
  return position === undefined
    ? refNameColorHexes[hashString(name) % refNameColorHexes.length]!
    : refNamePaletteColorAt(position)
}

export { category10, set1 }
