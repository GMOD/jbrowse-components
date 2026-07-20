import { set1 } from '@jbrowse/core/ui/colors'

import type { Feature } from '@jbrowse/core/util'

// The `featureColor` slot sentinel that selects SV-type cell coloring. Unlike
// the consequence preset (a fixed `jexl:impactColor(feature)` pure function),
// SV-type colors are assigned in the worker from the set of types actually
// present (so unrecognized types still get a distinct color), so this is a
// plain marker string handled in makeFeatureColor rather than a jexl function.
export const SV_TYPE_COLOR = 'svType'

// Bucket for a record whose ALT alleles span more than one SV class (e.g.
// ALT=<DEL>,<DUP>): a distinct flag color rather than silently picking one.
export const MIXED_SV_TYPE = 'MIXED'

// Canonical SV-type buckets in legend order, with their predefined colors and
// human-readable labels. Colors are all `set1` entries — the same palette
// unrecognized tokens draw from — so a predefined class and an auto-assigned
// token can't land on two near-identical shades from different palettes. Any
// type not listed here gets an auto-assigned palette color and shows its raw
// token as the label.
export const PREDEFINED_SV_TYPES = [
  { type: 'DEL', label: 'Deletion', color: '#e41a1c' },
  { type: 'DUP', label: 'Duplication', color: '#377eb8' },
  { type: 'INS', label: 'Insertion', color: '#4daf4a' },
  { type: 'INV', label: 'Inversion', color: '#ff7f00' },
  { type: 'CNV', label: 'Copy number', color: '#984ea3' },
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
  // <CN0>/<CN2>/... copy-number alleles are a CNV class
  return /^CN\d+$/.test(token) ? 'CNV' : (RAW_TOKEN_TO_BUCKET[token] ?? token)
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
  const isBreakend =
    alt.includes('[') ||
    alt.includes(']') ||
    alt.startsWith('.') ||
    alt.endsWith('.')
  return isBreakend ? 'BND' : ''
}

/**
 * The structural-variant class of a variant as a whole, as a canonical bucket
 * (DEL/DUP/INS/INV/CNV/BND), MIXED when its ALT alleles span more than one
 * class, an unrecognized raw token, or '' when it is not a structural variant.
 * ALT drives the class (a multi-class record is MIXED regardless of SVTYPE);
 * for a single class the declared INFO/SVTYPE is preferred, else the lone ALT
 * class.
 */
export function getVariantSvType(feature: Feature) {
  const alt = feature.get('ALT') as string[] | undefined
  const classes = new Set<string>()
  for (const a of alt ?? []) {
    const t = svTypeFromAlt(a)
    if (t) {
      classes.add(t)
    }
  }
  if (classes.size > 1) {
    return MIXED_SV_TYPE
  }
  const info = feature.get('INFO') as Record<string, unknown> | undefined
  const svtype = info?.SVTYPE
  const raw = Array.isArray(svtype) ? svtype[0] : svtype
  if (typeof raw === 'string' && raw && raw !== '.') {
    return normalizeRawToken(raw)
  }
  const [only] = classes
  return only ?? ''
}

/**
 * Whether the variant is a structural variant, gating the "Color by...→SV type"
 * menu option (like featureHasConsequence gates the consequence option) so it
 * isn't offered on plain SNP/indel VCFs.
 */
export function featureHasSvType(feature: Feature) {
  return getVariantSvType(feature) !== ''
}

// Human-readable legend label for a bucket or raw token.
export function svTypeDisplayLabel(type: string) {
  return PREDEFINED_LABEL[type] ?? type
}

/**
 * Assign a color to each present SV type: the predefined color for a known
 * bucket, otherwise the next categorical-palette color not already taken.
 * Deterministic: known buckets first in canonical order, then unrecognized
 * tokens alphabetically. The result is shipped to the client so legend swatches
 * exactly match the painted cells.
 */
export function assignSvTypeColors(types: string[]): Record<string, string> {
  const known = types
    .filter(t => t in CANONICAL_ORDER)
    .sort((a, b) => CANONICAL_ORDER[a]! - CANONICAL_ORDER[b]!)
  const unknown = types.filter(t => !(t in CANONICAL_ORDER)).sort()

  const result: Record<string, string> = {}
  const used = new Set<string>()
  for (const type of known) {
    const color = PREDEFINED_COLOR[type]!
    result[type] = color
    used.add(color)
  }
  // Draw unrecognized tokens from the same set1 palette, skipping colors a
  // predefined class already took — so e.g. a CPX token can't land on the same
  // blue as Duplication. Falls back to cycling the full palette only if a VCF
  // has more distinct SV types than set1 has colors (real callsets don't).
  const free = set1.filter(c => !used.has(c))
  unknown.forEach((type, i) => {
    result[type] = free.length ? free[i % free.length]! : set1[i % set1.length]!
  })
  return result
}
