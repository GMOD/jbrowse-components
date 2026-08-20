import { resolveContinuousMode } from './colorRamps.ts'
import { colorByAttributeName, colorSchemes } from './colorUtils.ts'

import type { AttributeRange, Rgb } from './colorRamps.ts'
import type { SyntenyColorBy } from './colorUtils.ts'

const rgbCss = ([r, g, b]: Rgb) => `rgb(${r},${g},${b})`

export interface GradientStop {
  offset: number
  color: string
}

// Sample a ramp at 9 stops, drawn from the exact same toRgb the renderer uses
// so the two can't disagree. Consumed as a CSS gradient (HTML legend) and as
// SVG <stop>s (export legend).
function rampStops(toRgb: (norm: number) => Rgb): GradientStop[] {
  return Array.from({ length: 9 }, (_, i) => ({
    offset: i / 8,
    color: rgbCss(toRgb(i / 8)),
  }))
}

function gradientCss(stops: GradientStop[]) {
  const list = stops.map(s => `${s.color} ${Math.round(s.offset * 100)}%`)
  return `linear-gradient(to right, ${list.join(',')})`
}

function ramp(
  toRgb: (norm: number) => Rgb,
  minLabel: string,
  maxLabel: string,
): ColorBySwatchSpec {
  const stops = rampStops(toRgb)
  return {
    kind: 'ramp',
    background: gradientCss(stops),
    stops,
    minLabel,
    maxLabel,
  }
}

export interface ColorChip {
  // omitted for a row that names something with no single color — a track
  // painting an identity ramp while a sibling paints flat, say
  color?: string
  label: string
}

// Bitmask over the CIGAR indel ops actually painted in the current geometry —
// a set, so views union it with a single `|`. The ribbon legend keys chip
// colors to what's on screen and lists an indel chip only when its bit is set;
// the worker already drops sub-pixel indels, so at whole-genome zoom this is 0
// and the legend shows just the match/strand chips instead of dead "insertion"/
// "deletion" swatches for detail the eye can't find. Bits are independent of
// the renderer's KIND_* numbering; the producer maps kinds to them.
export type CigarOpMask = number
export const CIGAR_OP_I = 1
export const CIGAR_OP_D = 2
export const CIGAR_OP_N = 4

// Static menu preview / default legend: the two indel ops a typical alignment
// carries. N (skip) is opt-in — it only appears in spliced alignments, so the
// preview omits it while the data-driven legend still surfaces it when present.
export const NO_CIGAR_OPS: CigarOpMask = 0
const DEFAULT_CIGAR_OPS: CigarOpMask = CIGAR_OP_I | CIGAR_OP_D

// A continuous mode maps to a gradient ramp with domain labels; the structural
// modes (default/strand) map to a set of discrete labeled chips — including the
// CIGAR indel colors those modes overlay, which a single swatch can't convey.
export type ColorBySwatchSpec =
  | {
      kind: 'ramp'
      background: string
      stops: GradientStop[]
      // required: `ramp()` is the only producer and always names both ends, so a
      // labelless ramp is not a state either legend has to render
      minLabel: string
      maxLabel: string
    }
  | { kind: 'chips'; chips: ColorChip[] }

const { cigarColors: defaultCigar, pointColor } = colorSchemes.default
const { posColor, negColor, cigarColors: strandCigar } = colorSchemes.strand

// default/strand draw block colors plus the CIGAR indel ops present on screen.
// One chip per set op bit, drawn from the active scheme's colors so they can't
// drift from the renderer.
function indelChips(
  cigar: { I: string; D: string; N: string },
  ops: CigarOpMask,
): ColorChip[] {
  const chips: ColorChip[] = []
  if (ops & CIGAR_OP_I) {
    chips.push({ color: cigar.I, label: 'insertion' })
  }
  if (ops & CIGAR_OP_D) {
    chips.push({ color: cigar.D, label: 'deletion' })
  }
  if (ops & CIGAR_OP_N) {
    chips.push({ color: cigar.N, label: 'skip' })
  }
  return chips
}

const PRESET_LABELS: Record<string, string> = {
  default: 'Default',
  strand: 'Strand',
  query: 'Query name',
  target: 'Target name',
  reference: 'Reference name',
  identity: 'Identity',
  meanQueryIdentity: 'Mean query identity',
  mappingQuality: 'Mapping quality',
  dnds: 'dN/dS',
  track: 'Track',
}

/**
 * #api
 * Short human-readable title for the floating legend header. An
 * `attribute:<name>` mode has no title but the column's own name, which is the
 * point of it — the reader named that column.
 */
export function colorByShortLabel(colorBy: SyntenyColorBy) {
  return PRESET_LABELS[colorBy] ?? colorByAttributeName(colorBy) ?? colorBy
}

/**
 * #api
 * The legend rows that name the overlaid tracks. Two cases produce them, and
 * both views build them the same way so the on-screen and exported legends
 * can't diverge:
 *
 * - every track on `'track'`: one chip per track, its palette color and name.
 * - tracks on different modes: one row per track naming its mode, with a swatch
 *   only where the track has a single color to show (a track on an identity
 *   ramp has none).
 *
 * Any other uniform mode has a fixed legend of its own and returns nothing.
 */
export function trackLegendChips(
  tracks: readonly {
    name: string
    colorBy: SyntenyColorBy
    trackColor: string
  }[],
  uniformColorBy: SyntenyColorBy | undefined,
): ColorChip[] {
  if (uniformColorBy === 'track') {
    return tracks.map(t => ({ color: t.trackColor, label: t.name }))
  }
  return uniformColorBy === undefined
    ? tracks.map(t => ({
        color: t.colorBy === 'track' ? t.trackColor : undefined,
        label: `${t.name} — ${colorByShortLabel(t.colorBy)}`,
      }))
    : []
}

// What a mode with no swatch spec is doing instead. Lives here rather than
// inline in each legend so the HTML and SVG legends can't say different things
// — the same rule this file already applies to chip colors and ramp stops.
export function colorByFallbackNote(colorBy: SyntenyColorBy) {
  return colorBy === 'track'
    ? 'Distinct color per track'
    : 'Distinct color per sequence'
}

// Legend spec for a color-by mode: a gradient ramp for continuous modes, or a
// set of labeled chips for the structural modes. Returns undefined for the
// per-name categorical modes (query/target), which have no fixed legend.
// `pointBased` is true for the dotplot (flat points, no CIGAR); `cigarOps`
// selects which indel chips the ribbon legend shows — the caller passes the
// ops actually drawn on screen, defaulting to the static I+D menu preview.
export function getColorBySwatch(
  colorBy: SyntenyColorBy,
  {
    pointBased = false,
    cigarOps = DEFAULT_CIGAR_OPS,
    trackChips,
    attributeRanges,
  }: {
    pointBased?: boolean
    cigarOps?: CigarOpMask
    // one chip per overlaid track, supplied by the view for colorBy:'track'
    // (this file can't know the track list). Absent or empty falls back to the
    // "distinct color per track" note.
    trackChips?: ColorChip[]
    // observed span per attribute, which is the domain an `attribute:<name>`
    // mode scales to and therefore what its ramp has to be labelled with
    attributeRanges?: Record<string, AttributeRange>
  } = {},
): ColorBySwatchSpec | undefined {
  // dotplot paints flat points and never draws CIGAR ops
  const ops = pointBased ? NO_CIGAR_OPS : cigarOps
  // Every continuous mode, preset or attribute, reads its ramp and its domain
  // labels off the one spec the renderer paints from, so a new measurement
  // needs no arm here at all. For the diverging preset the pivot is the ramp's
  // own pale middle, which is what the end labels alone cannot say.
  const continuous = resolveContinuousMode(colorBy, attributeRanges)
  if (continuous) {
    return ramp(continuous.toRgb, continuous.minLabel, continuous.maxLabel)
  }
  switch (colorBy) {
    case 'strand':
      return {
        kind: 'chips',
        chips: [
          { color: posColor, label: 'forward' },
          { color: negColor, label: 'reverse' },
          ...indelChips(strandCigar, ops),
        ],
      }
    case 'default':
      return {
        kind: 'chips',
        // dotplot draws each alignment as one flat point, not the ribbon's red
        // match block
        chips: pointBased
          ? [{ color: pointColor, label: 'alignment' }]
          : [
              { color: defaultCigar.M, label: 'match' },
              ...indelChips(defaultCigar, ops),
            ],
      }
    case 'track':
      return trackChips?.length
        ? { kind: 'chips', chips: trackChips }
        : undefined
    default:
      // query / target / reference paint a color per sequence name, which has
      // no fixed key
      return undefined
  }
}
