import { category10 } from '@jbrowse/core/ui/colors'

import type { Feature } from '@jbrowse/core/util'

// The `featureColor` slot sentinel that selects SV-type cell coloring. Unlike
// the consequence preset (a fixed `jexl:impactColor(feature)` pure function),
// SV-type colors are assigned in the worker from the set of types actually
// present (so unrecognized types still get a distinct color), so this is a
// plain marker string handled in makeFeatureColor rather than a jexl function.
export const SV_TYPE_COLOR = 'svType'

// Canonical SV-type buckets in legend order, with their predefined colors and
// human-readable labels. Any type not listed here is an unrecognized token that
// gets an auto-assigned palette color and shows its raw token as the label.
export const PREDEFINED_SV_TYPES = [
  { type: 'DEL', label: 'Deletion', color: '#e41a1c' },
  { type: 'DUP', label: 'Duplication', color: '#377eb8' },
  { type: 'INS', label: 'Insertion', color: '#4daf4a' },
  { type: 'INV', label: 'Inversion', color: '#ff7f00' },
  { type: 'CNV', label: 'Copy number', color: '#984ea3' },
  { type: 'BND', label: 'Breakend', color: '#a65628' },
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
 * The structural-variant class of a variant as a whole (its primary ALT), as a
 * canonical bucket (DEL/DUP/INS/INV/CNV/BND) or an unrecognized raw token, or
 * '' when the variant is not a structural variant. Prefers the canonical
 * INFO/SVTYPE field, else derives from the first symbolic/breakend ALT.
 * Allele-specific coloring uses svTypeFromAlt per ALT instead.
 */
export function getVariantSvType(feature: Feature) {
  const info = feature.get('INFO') as Record<string, unknown> | undefined
  const svtype = info?.SVTYPE
  const raw = Array.isArray(svtype) ? svtype[0] : svtype
  if (typeof raw === 'string' && raw && raw !== '.') {
    return normalizeRawToken(raw)
  }
  const alt = feature.get('ALT') as string[] | undefined
  for (const a of alt ?? []) {
    const t = svTypeFromAlt(a)
    if (t) {
      return t
    }
  }
  return ''
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
  for (const type of known) {
    result[type] = PREDEFINED_COLOR[type]!
  }
  // category10 shares no colors with the predefined set1 palette, so cycling it
  // for unrecognized tokens can't collide with a predefined swatch (it only
  // repeats among unknowns past 10 distinct types, which real VCFs don't hit).
  unknown.forEach((type, i) => {
    result[type] = category10[i % category10.length]!
  })
  return result
}
