import { NO_VALUE_LABEL } from '@jbrowse/core/util/categoricalField'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { groupKeyComparator } from '@jbrowse/core/util/groupKeys'
import { MAX_LEGEND_ENTRIES } from '@jbrowse/core/util/legendCandidates'

import { bandGroundColor } from './bandGround.ts'
import { categoricalColor } from './colorFunctions.ts'
import { resolveCategoricalMode, resolveContinuousMode } from './colorRamps.ts'
import { colorSchemes, legendChipColor } from './colorUtils.ts'

import type { AttributeRange, CategoricalMode, Rgb } from './colorRamps.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'

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
  domain: [number, number],
  minLabel: string,
  maxLabel: string,
): ColorBySwatchSpec {
  const stops = rampStops(toRgb)
  return {
    kind: 'ramp',
    background: gradientCss(stops),
    stops,
    domain,
    minLabel,
    maxLabel,
  }
}

export interface ColorChip {
  // omitted for a row that names something with no single color — a track
  // painting an identity ramp while a sibling paints flat, say
  color?: string
  label: string
  // every label painted in `color`, which `label` names joined
  values?: string[]
  // the row naming the rows the column left unlabelled, which a key places
  // after the labels whatever orders them
  missing?: boolean
}

// One chip per color, naming every label painted in it: SyRI's palette gives
// INVDP the color of DUP, as plotsr does, and two rows with one swatch would
// ask the reader to tell apart what the plot cannot.
function labelChips(categorical: CategoricalMode): ColorChip[] {
  const rows = new Map<number, { color: string; values: string[] }>()
  for (const label of categorical.labels) {
    const color = categoricalColor(categorical, label)
    const key = cssColorToABGR(color)
    const row = rows.get(key)
    if (row) {
      row.values.push(label)
    } else {
      rows.set(key, { color, values: [label] })
    }
  }
  const compare = groupKeyComparator(categorical.domain)
  return [...rows.values()].map(({ color, values }) => {
    const sorted = values.toSorted(compare)
    return { color, label: sorted.join(', '), values: sorted }
  })
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
      domain: [number, number]
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
  '': 'Default',
  strand: 'Strand',
  query: 'Query name',
  target: 'Target name',
  reference: 'Reference name',
  identity: 'Identity',
  mappingQual: 'Mapping quality',
  dnds: 'dN/dS',
  track: 'Track',
}

/**
 * #api
 * Short human-readable title for the floating legend header. A column has no
 * title but its own name, which is the point of it — the reader named it.
 */
export function colorByShortLabel(field: string) {
  return PRESET_LABELS[field] ?? field
}

// What a field with no swatch spec is doing instead. Lives here rather than
// inline in each legend so the HTML and SVG legends can't say different things
// — the same rule this file already applies to chip colors and ramp stops.
export function colorByFallbackNote(field: string) {
  return field === 'track'
    ? 'Distinct color per track'
    : 'Distinct color per sequence'
}

// Legend spec for a colour field: a gradient ramp for a measurement or numeric
// column, labeled chips for the structural fields and a text column. Returns
// undefined for the per-name fields (query/target/reference), which have no
// fixed legend. `pointBased` is true for the dotplot (flat points, no CIGAR);
// `cigarOps` selects which indel chips the ribbon legend shows — the caller
// passes the ops actually drawn on screen, defaulting to the static I+D menu
// preview.
export function getColorBySwatch(
  field: string,
  {
    pointBased = false,
    cigarOps = DEFAULT_CIGAR_OPS,
    trackChips,
    attributeRanges,
    hideUnlabelled = false,
  }: {
    pointBased?: boolean
    cigarOps?: CigarOpMask
    // one chip per overlaid track, supplied by the view for the 'track' field
    // (this file can't know the track list). Absent or empty falls back to the
    // "distinct color per track" note.
    trackChips?: ColorChip[]
    // observed span per attribute, which is the domain a column's ramp
    // scales to and therefore what it has to be labelled with
    attributeRanges?: Record<string, AttributeRange>
    // the unlabelled rows draw at zero alpha, so the key names no grey
    hideUnlabelled?: boolean
  } = {},
): ColorBySwatchSpec | undefined {
  // dotplot paints flat points and never draws CIGAR ops
  const ops = pointBased ? NO_CIGAR_OPS : cigarOps
  switch (field) {
    case '':
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
    case 'strand':
      return {
        kind: 'chips',
        chips: [
          { color: posColor, label: 'forward' },
          { color: negColor, label: 'reverse' },
          ...indelChips(strandCigar, ops),
        ],
      }
    case 'track':
      return trackChips?.length
        ? { kind: 'chips', chips: trackChips }
        : undefined
    case 'query':
    case 'target':
    case 'reference':
      // a color per sequence name has no fixed key
      return undefined
  }
  // Every ramp, preset or column, reads its stops and its domain labels off
  // the one spec the renderer paints from, so a new measurement needs no arm
  // here. For the diverging preset the pivot is the ramp's own pale middle,
  // which is what the end labels alone cannot say.
  const continuous = resolveContinuousMode(field, attributeRanges)
  if (continuous) {
    return ramp(
      continuous.toRgb,
      [continuous.minValue ?? 0, continuous.maxValue],
      continuous.minLabel,
      continuous.maxLabel,
    )
  }
  const categorical = resolveCategoricalMode(field, attributeRanges)
  if (!categorical) {
    return undefined
  }
  const chips = labelChips(categorical)
  const shown = chips.slice(0, MAX_LEGEND_ENTRIES)
  const rest = chips.length - shown.length
  return {
    kind: 'chips',
    chips: [
      ...shown,
      ...(rest > 0 ? [{ label: `+${rest} more` }] : []),
      // The grey the column's unlabelled rows paint, once any fetch has met
      // one, as a label is listed once any fetch has met it. The mode that
      // hides those rows draws no grey.
      ...(hideUnlabelled || !categorical.unlabelled
        ? []
        : [
            {
              color: NO_CATEGORY_COLOR,
              label: NO_VALUE_LABEL,
              missing: true,
            },
          ]),
    ],
  }
}

/**
 * #api
 * The active mode's key as one color scale — what a view's `colorScales`
 * lists, and so what `ChromeLegend` and `SvgLegend` draw. A ramp keeps its
 * own end labels (identity's `0%` and `100%`, dN/dS's `≥2`) through `format`;
 * chips are blended over the band's ground by the view's alpha, so the key
 * matches the on-screen composited ribbon colors, subject to
 * `legendChipColor`'s legibility floor; a mode with no fixed key (a color per
 * sequence name) is a note row saying so.
 */
export function colorByScale(
  field: string,
  {
    alpha = 1,
    ...opts
  }: Parameters<typeof getColorBySwatch>[1] & { alpha?: number } = {},
): ColorScale {
  const swatch = getColorBySwatch(field, opts)
  const title = colorByShortLabel(field)
  if (swatch?.kind === 'ramp') {
    const { domain, minLabel, maxLabel, stops } = swatch
    return {
      kind: 'ramp',
      id: field,
      title,
      domain,
      stops,
      format: v => (v === domain[0] ? minLabel : maxLabel),
    }
  }
  const ground = bandGroundColor()
  return {
    kind: 'categorical',
    id: field || 'default',
    title,
    entries: swatch
      ? swatch.chips.map(({ color, label, values, missing }) => ({
          value: values?.[0] ?? label,
          ...(values ? { values } : {}),
          label,
          color:
            color === undefined
              ? undefined
              : legendChipColor(color, alpha, ground),
          ...(missing ? { missing } : {}),
        }))
      : [{ value: 'note', label: colorByFallbackNote(field) }],
  }
}
