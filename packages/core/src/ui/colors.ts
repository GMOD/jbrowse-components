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

// The by-refName painting palette. category10's grey (#7f7f7f) is dropped: a
// grey chromosome reads as "uncolored/broken", and it collides with every
// display's own neutral — the synteny ribbon default, the alignments
// `noTagValue` fill.
const refNameColorHexes = category10.filter(
  hex => hex.toLowerCase() !== '#7f7f7f',
)

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
