import { set1 } from '@jbrowse/core/ui/colors'

import { isBreakend } from '../VcfFeature/util.ts'
import { ALT_HUE } from './cellFill.ts'

import type { CategoricalEntry } from '@jbrowse/core/ui/colorScale'
import type { Feature } from '@jbrowse/core/util'

// The `featureColor` slot sentinel that selects SV-type cell coloring. Unlike
// the consequence preset (a fixed `jexl:impactColor(feature)` pure function),
// SV-type colors are assigned in the worker from the set of types actually
// present (so unrecognized types still get a distinct color), so this is a
// plain marker string handled in makeFeatureColor rather than a jexl function.
export const SV_TYPE_COLOR = 'svType'

// The `color` slot jexl preset that paints single-variant features by SV class,
// backed by the `svTypeColor` jexl function. The multi-sample displays use the
// SV_TYPE_COLOR sentinel + a worker-computed present-only palette instead; this
// pure-function form suits the single-variant display, whose `color` slot takes
// a jexl string (same shape as the consequence CONSEQUENCE_IMPACT_JEXL preset).
export const SV_TYPE_COLOR_JEXL = 'jexl:svTypeColor(feature)'

// Fallback for a variant that isn't a recognized SV class (a plain SNV/indel, or
// an unrecognized token) when painting by SV type on the single-variant display.
export const OTHER_SV_COLOR = '#808080'

// What the key calls that grey. It covers two things the multi-sample palette
// tells apart — a record with no structural class, and a token this pure
// function cannot place — so the row says both rather than borrowing
// `NON_SV_TYPE`'s name for half of what it paints.
export const OTHER_SV_LABEL = 'SNV/indel or unrecognized'

/**
 * The domain value a record with no structural class takes when the multi-sample
 * displays paint by SV type. An explicit member of the scale, not a gap in it:
 * without one, half a mixed callset painted the default alt blue beside the
 * class colors and the mode read as two scales at once.
 */
export const NON_SV_TYPE = 'SNV/indel'

// Bucket for a record whose ALT alleles span more than one SV class (e.g.
// ALT=<DEL>,<DUP>): a distinct flag color rather than silently picking one.
const MIXED_SV_TYPE = 'MIXED'

// Canonical SV-type buckets in legend order, with their predefined colors and
// human-readable labels. Colors are `set1` entries — the palette unrecognized
// tokens draw from — except insertion's and copy number's. Set1's purple sat
// beside insertion's, and its pink beside the magenta a het insertion shades
// to, so copy number takes teal. Any type not listed here gets an
// auto-assigned palette color and shows its raw token as the label.
export const PREDEFINED_SV_TYPES = [
  { type: 'DEL', label: 'Deletion', color: '#e41a1c' },
  { type: 'DUP', label: 'Duplication', color: '#377eb8' },
  // palette.insertion, so an insertion is one color across the pileup, the MAF
  // display and this one
  { type: 'INS', label: 'Insertion', color: '#800080' },
  { type: 'INV', label: 'Inversion', color: '#ff7f00' },
  { type: 'CNV', label: 'Copy number', color: '#1b9e77' },
  { type: 'BND', label: 'Breakend', color: '#a65628' },
  { type: MIXED_SV_TYPE, label: 'Mixed', color: '#999999' },
] as const

const PREDEFINED_COLOR: Record<string, string> = Object.fromEntries(
  PREDEFINED_SV_TYPES.map(t => [t.type, t.color]),
)
const PREDEFINED_LABEL: Record<string, string> = Object.fromEntries(
  PREDEFINED_SV_TYPES.map(t => [t.type, t.label]),
)
const CANONICAL_ORDER: Record<string, number> = Object.fromEntries(
  PREDEFINED_SV_TYPES.map((t, i) => [t.type, i]),
)

// Raw SVTYPE / symbolic-ALT tokens (e.g. DEL, DUP:TANDEM) fold into these
// buckets; unrecognized tokens pass through uppercased so they still get a
// distinct auto-assigned color.
const RAW_TOKEN_TO_BUCKET: Record<string, string> = {
  DEL: 'DEL',
  DUP: 'DUP',
  INS: 'INS',
  INV: 'INV',
  CNV: 'CNV',
  BND: 'BND',
  TRA: 'BND',
}

function normalizeRawToken(raw: string) {
  const token = raw.toUpperCase().split(':')[0]!.trim()
  return RAW_TOKEN_TO_BUCKET[token] ?? token
}

/**
 * The class a bare `SVTYPE` token names, for a caller holding the declared type
 * and no parsed record to read an ALT from — a spreadsheet row whose feature
 * did not survive an older session, say. `''` for a token that names nothing.
 */
export function svTypeFromToken(raw: string) {
  return raw && raw !== '.' ? normalizeRawToken(raw) : ''
}

// <CN0>/<CN1>/<CN3>/... copy-number alleles: kept as distinct types (not folded
// into one CNV bucket) so each copy-number state gets its own color.
function isCopyNumberType(type: string) {
  return /^CN\d+$/.test(type)
}
function copyNumberValue(type: string) {
  return Number(type.slice(2))
}

// Absolute copy-number -> rainbow color: CN0 blue, ascending through green to
// red, capped at CN_COLOR_CAP so the color is stable per value (CN3 always the
// same) regardless of what else is in view. Deliberately NOT centered on CN2 —
// we can't assume a diploid baseline — so it's a plain ascending spectrum, not a
// loss/gain diverging scale.
const CN_COLOR_CAP = 10
function copyNumberColor(cn: number) {
  const v = Math.min(Math.max(cn, 0), CN_COLOR_CAP) / CN_COLOR_CAP
  return `hsl(${Math.round(240 * (1 - v))}, 70%, 50%)`
}

/**
 * The SV class implied by a single ALT allele string: the token inside a
 * symbolic `<...>` allele (normalized), `BND` for breakend notation, or '' for
 * a plain sequence allele (a SNV/indel, not a structural variant). This reads
 * the ALT directly rather than the human-readable SO `type`, which collapses
 * distinct classes (every breakend flavor becomes 'breakend').
 */
export function svTypeFromAlt(alt: string) {
  if (alt.startsWith('<') && alt.endsWith('>')) {
    return normalizeRawToken(alt.slice(1, -1))
  }
  return isBreakend(alt) ? 'BND' : ''
}

/** The conventional size floor for calling a sequence indel structural. */
export const SV_MIN_LENGTH = 50

// A plain sequence ALT is an insertion or deletion of SV size when it differs
// from REF by at least SV_MIN_LENGTH bases. A decomposed pangenome callset
// spells every SV this way, with no symbolic allele and no SVTYPE, so without
// this the SV-type scale saw nothing structural in it.
function sequenceSvType(alt: string, ref: string | undefined) {
  if (!ref || alt.startsWith('<') || isBreakend(alt)) {
    return ''
  }
  const diff = alt.length - ref.length
  if (diff >= SV_MIN_LENGTH) {
    return 'INS'
  }
  return diff <= -SV_MIN_LENGTH ? 'DEL' : ''
}

/**
 * The structural-variant class of a variant as a whole: a canonical bucket
 * (DEL/DUP/INS/INV/CNV/BND), a specific copy-number state (CN0/CN1/CN3/...),
 * MIXED when its ALT alleles span more than one genuine class, an unrecognized
 * token, or '' when it is not a structural variant. ALT drives the class (so a
 * `<CN3>` allele keeps its copy number even when SVTYPE just says CNV); a record
 * with several distinct copy-number states can't map to one color and falls back
 * to the generic CNV bucket. SVTYPE is only a fallback when the ALT is
 * uninformative (non-symbolic).
 */
export function getVariantSvType(feature: Feature) {
  const alt = feature.get('ALT') as string[] | undefined
  const ref = feature.get('REF') as string | undefined
  const classes = new Set<string>()
  for (const a of alt ?? []) {
    const t = svTypeFromAlt(a) || sequenceSvType(a, ref)
    if (t) {
      classes.add(t)
    }
  }
  if (classes.size > 1) {
    // Several copy-number states on one record can't map to a single color, so
    // fall back to the generic CNV bucket; genuinely different SV classes are
    // flagged MIXED.
    return [...classes].every(t => t === 'CNV' || isCopyNumberType(t))
      ? 'CNV'
      : MIXED_SV_TYPE
  }
  if (classes.size === 1) {
    const [only] = classes
    return only!
  }
  // No informative (symbolic/breakend) ALT: fall back to the declared SVTYPE.
  const info = feature.get('INFO') as Record<string, unknown> | undefined
  const svtype = info?.SVTYPE
  const raw = Array.isArray(svtype) ? svtype[0] : svtype
  return typeof raw === 'string' ? svTypeFromToken(raw) : ''
}

/**
 * A fixed CSS color for an SV class: the predefined class color, the absolute
 * copy-number rainbow color for a CN state, else a neutral grey for a non-SV or
 * unrecognized token. Unlike the multi-sample palette this is a pure function
 * (no present-set auto-assignment), so it can't distinguish arbitrary unknown
 * tokens — those all read grey.
 *
 * By class rather than by feature, so a legend — which has counted its classes
 * and no longer holds a record of each — paints the same swatch the records
 * themselves get.
 */
export function getSvTypeColor(type: string) {
  return isCopyNumberType(type)
    ? copyNumberColor(copyNumberValue(type))
    : (PREDEFINED_COLOR[type] ?? OTHER_SV_COLOR)
}

/**
 * The SV-type key's rows for the display painting through `getSvTypeColor`:
 * the predefined classes, then the grey everything that function cannot place
 * takes. A copy-number state's rainbow color is the one thing the painter
 * hands out that this cannot list, there being no present set to enumerate —
 * `assignSvTypeColors` is the multi-sample path that has one.
 */
export function svTypeLegendEntries(): CategoricalEntry[] {
  return [
    ...PREDEFINED_SV_TYPES.map(t => ({
      value: t.label,
      label: t.label,
      color: t.color,
    })),
    {
      value: OTHER_SV_LABEL,
      label: OTHER_SV_LABEL,
      color: OTHER_SV_COLOR,
      missing: true,
    },
  ]
}

/**
 * The color a variant is painted, for the single-variant display's `color` slot
 * (via the `svTypeColor` jexl function).
 */
export function getVariantSvTypeColor(feature: Feature) {
  return getSvTypeColor(getVariantSvType(feature))
}

// Human-readable legend label for a bucket, copy-number state, or raw token.
export function svTypeDisplayLabel(type: string) {
  return PREDEFINED_LABEL[type] ?? type
}

/**
 * Assign a color to each present SV type: the predefined color for a known
 * bucket, an absolute copy-number rainbow color for a CN state, otherwise the
 * next set1 color not already taken. Deterministic and ordered — known buckets
 * in canonical order, then copy-number states ascending, then other tokens
 * alphabetically — so the shipped map's legend reads in that order and its
 * swatches exactly match the painted cells.
 */
export function assignSvTypeColors(types: string[]): Record<string, string> {
  const known = types
    .filter(t => t in CANONICAL_ORDER)
    .sort((a, b) => CANONICAL_ORDER[a]! - CANONICAL_ORDER[b]!)
  const copyNumbers = types
    .filter(isCopyNumberType)
    .sort((a, b) => copyNumberValue(a) - copyNumberValue(b))
  const other = types
    .filter(
      t => !(t in CANONICAL_ORDER) && !isCopyNumberType(t) && t !== NON_SV_TYPE,
    )
    .sort()

  const result: Record<string, string> = {}
  const used = new Set<string>()
  for (const type of known) {
    const color = PREDEFINED_COLOR[type]!
    result[type] = color
    used.add(color)
  }
  for (const type of copyNumbers) {
    result[type] = copyNumberColor(copyNumberValue(type))
  }
  // Draw the remaining unrecognized tokens from the same set1 palette, skipping
  // colors a predefined class already took — so e.g. a CPX token can't land on
  // the same blue as Duplication. Falls back to cycling the full palette only if
  // a VCF has more distinct SV types than set1 has colors (real callsets don't).
  const free = set1.filter(c => !used.has(c))
  other.forEach((type, i) => {
    result[type] = free.length ? free[i % free.length]! : set1[i % set1.length]!
  })
  // Last, and the default scale's alt hue: it is the scale's "no structural
  // class" member, which is what an alt cell means with no further meaning on
  // it. A grey put its het and triploid shades on the reference grey's own
  // ramp.
  if (types.includes(NON_SV_TYPE)) {
    result[NON_SV_TYPE] = ALT_HUE
  }
  return result
}
