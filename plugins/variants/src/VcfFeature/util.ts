import { getBpDisplayStr, max, toLocale } from '@jbrowse/core/util'

import { GENOTYPE_SPLITTER as genotypeDelimRegex } from '../shared/constants.ts'

import type VCF from '@gmod/vcf'
import type { Variant } from '@gmod/vcf'

// Coerce a VCF INFO value (which may be a string like '5', a number, '.', or
// undefined) to a finite number, or undefined when it isn't numeric. VCF uses
// '.' for missing values, which would otherwise coerce to NaN and leak into
// feature coordinates / descriptions.
export function parseFiniteNumber(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

// First numeric entry of an INFO field, or undefined when the field is absent
// or carries only missing/non-numeric values.
function firstNumericInfo(
  info: Record<string, unknown> | undefined,
  key: string,
) {
  const value = info?.[key]
  return Array.isArray(value) ? parseFiniteNumber(value[0]) : undefined
}

// Breakend notation, without parsing it: bracket forms (`G[chr2:100[`), single
// breakends (`.A` / `G.`), and the symbolic-mate form (`G<DEL>`, angle bracket
// past position 0 — a leading `<` is a plain symbolic allele instead). The one
// definition of the predicate; `svTypeFromAlt` and `getSOTerm` both read it, so
// a breakend can't be one thing to the SO term and another to the SV color.
export function isBreakend(alt: string) {
  return (
    alt.includes('[') ||
    alt.includes(']') ||
    alt.startsWith('.') ||
    alt.endsWith('.') ||
    alt.lastIndexOf('<') > 0
  )
}

function isSymbolic(alt: string) {
  return alt.startsWith('<') || isBreakend(alt)
}

// Symbolic (angle-bracket) ALTs carry their span in INFO.END / INFO.SVLEN
// rather than in REF. Breakends (which use `[`/`]`, not `<`) and translocations
// are single-breakpoint, so they intentionally fall through to REF.length.
export function getEnd(variant: Variant, start: number) {
  const { REF = '', ALT = [], INFO } = variant
  const hasSymbolic = ALT.some(a => a.startsWith('<'))
  const hasTRA = ALT.includes('<TRA>')
  if (hasSymbolic && !hasTRA) {
    // an END at or before POS describes no span on this contig; real SV
    // callsets do emit them, and trusting one inserts an inverted interval into
    // the adapter's IntervalTree. Treat it as absent and keep falling back.
    const end = firstNumericInfo(INFO, 'END')
    if (end !== undefined && end > start) {
      return end
    }
    if (Array.isArray(INFO.SVLEN)) {
      // insertions don't consume reference, so their span is 1; drop any
      // missing/non-numeric SVLEN entries (e.g. '.') rather than let NaN leak
      const lens = INFO.SVLEN.map((len, i) =>
        ALT[i]?.startsWith('<INS') ? 1 : parseFiniteNumber(len),
      ).filter(v => v !== undefined)
      const span = lens.length > 0 ? max(lens.map(Math.abs)) : 0
      if (span > 0) {
        return start + span
      }
    }
  }
  return start + REF.length
}

// Render an allele sequence verbatim when short enough to read, otherwise a
// compact base-pair count. Single source of the abbreviation threshold so ref
// and alt never disagree within one rendered string.
const ABBREVIATE_ALLELE_THRESHOLD = 10
function abbreviateAllele(seq: string) {
  return seq.length >= ABBREVIATE_ALLELE_THRESHOLD
    ? getBpDisplayStr(seq.length)
    : seq
}

const altTypeToSO: Record<string, string> = {
  '<DEL>': 'deletion',
  '<INS>': 'insertion',
  '<DUP>': 'duplication',
  '<INV>': 'inversion',
  '<INVDUP>': 'inverted_duplication',
  '<CNV>': 'copy_number_variation',
  '<TRA>': 'translocation',
  '<DUP:TANDEM>': 'tandem_duplication',
  '<NON_REF>': 'sequence_variant',
  '<*>': 'sequence_variant',
}

export function getSOTermAndDescription(
  ref: string,
  alt: string[] | undefined,
  parser: VCF,
  info?: Record<string, unknown>,
): [string, string] {
  if (!alt || alt.length === 0) {
    return ['remark', 'no alternative alleles']
  }

  const soTerms = alt.map(a => getSOTerm(a, ref, parser))
  const uniqueSoTerms = [...new Set(soTerms)]
  const description = formatGroupDescription(ref, alt, info)

  return [uniqueSoTerms.join(','), description]
}

function getSOTerm(alt: string, ref: string, parser: VCF): string {
  if (alt.startsWith('<')) {
    return findSOTerm(alt, parser) ?? 'variant'
  }
  // `*` marks an allele missing because an overlapping deletion consumed it. It
  // is one character like a SNV alt, so the length comparison below would call
  // it an SNV; same term as the `<*>` spelling in altTypeToSO.
  if (alt === '*') {
    return 'sequence_variant'
  }
  if (isBreakend(alt)) {
    return 'breakend'
  }
  const lenRef = ref.length
  const lenAlt = alt.length
  if (lenRef === 1 && lenAlt === 1) {
    return 'SNV'
  }
  if (lenRef === lenAlt) {
    return 'substitution'
  }
  return lenRef < lenAlt ? 'insertion' : 'deletion'
}

// translocations are single-breakpoint, so SVLEN is not a span on this contig
// (same carve-out as getEnd): name the mate breakpoint instead. Commas are
// cosmetic — parseLocString strips them, so this stays navigable.
export function getTraMate(info?: Record<string, unknown>): string | undefined {
  const end = firstNumericInfo(info, 'END')
  return Array.isArray(info?.CHR2) && end !== undefined
    ? `${info.CHR2[0]}:${toLocale(end)}`
    : undefined
}

function formatGroupDescription(
  ref: string,
  alts: string[],
  info?: Record<string, unknown>,
): string {
  if (alts.every(isSymbolic)) {
    const svlenArr = Array.isArray(info?.SVLEN) ? info.SVLEN : undefined
    return alts
      .map((a, i) => {
        if (a === '<TRA>') {
          const mate = getTraMate(info)
          return mate === undefined ? a : `<TRA> ${mate}`
        }
        const svlen = parseFiniteNumber(svlenArr?.[i])
        return svlen !== undefined
          ? `${a} ${getBpDisplayStr(Math.abs(svlen))}`
          : a
      })
      .join(',')
  }

  return `${abbreviateAllele(ref)} -> ${alts.map(abbreviateAllele).join(',')}`
}

// Walk the term and its parents, most specific first, e.g. '<INS:ME:ALU>' ->
// '<INS:ME>' -> '<INS>'. Only if no level names a known class do we fall back
// to the header: `##ALT=<ID=...>` is keyed by the bare id, WITHOUT the angle
// brackets, so this lookup must strip them. It sits last because the reserved
// AltTypes table @gmod/vcf preloads includes entries like DEL:ME, and matching
// those would answer the vague 'sequence_variant' where the parent walk has a
// real term ('deletion').
function findSOTerm(alt: string, parser: VCF): string | undefined {
  const id = alt.slice(1, -1)
  const parts = id.split(':')
  for (let i = parts.length; i > 0; i--) {
    const term = `<${parts.slice(0, i).join(':')}>`
    if (term in altTypeToSO) {
      return altTypeToSO[term]
    }
    // integer copy-number alleles <CN0>, <CN1>, ... emitted by 1000 Genomes,
    // gnomAD-SV, and dbVar for multiallelic CNVs
    if (/^<CN\d+>$/.test(term)) {
      return 'copy_number_variation'
    }
  }
  return parser.getMetadata('ALT', id) ? 'sequence_variant' : undefined
}

export function getMinimalDesc(ref: string, alt: string) {
  if (isSymbolic(alt) || (ref.length === 1 && alt.length === 1)) {
    return alt
  }
  return `${abbreviateAllele(ref)} -> ${abbreviateAllele(alt)}`
}

export function resolveAllele(allele: string, ref: string, alt: string[]) {
  return allele === '.'
    ? '.'
    : +allele === 0
      ? `ref(${abbreviateAllele(ref)})`
      : getMinimalDesc(ref, alt[+allele - 1] ?? '')
}

export function makeSimpleAltString(
  genotype: string,
  ref: string,
  alt: string[],
) {
  return genotype
    .split(genotypeDelimRegex)
    .map(r => resolveAllele(r, ref, alt))
    .join(genotype.includes('|') ? '|' : '/')
}
