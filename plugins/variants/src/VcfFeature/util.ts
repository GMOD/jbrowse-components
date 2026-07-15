import { parseBreakend } from '@gmod/vcf'
import { getBpDisplayStr } from '@jbrowse/core/util'

import { GENOTYPE_SPLITTER as genotypeDelimRegex } from '../shared/constants.ts'

import type VCF from '@gmod/vcf'

// Coerce a VCF INFO value (which may be a string like '5', a number, '.', or
// undefined) to a finite number, or undefined when it isn't numeric. VCF uses
// '.' for missing values, which would otherwise coerce to NaN and leak into
// feature coordinates / descriptions.
export function parseFiniteNumber(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function isBreakend(alt: string) {
  return (
    alt.includes('[') ||
    alt.includes(']') ||
    alt.startsWith('.') ||
    alt.endsWith('.')
  )
}

function isSymbolic(alt: string) {
  return alt.startsWith('<') || isBreakend(alt)
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
  if (parseBreakend(alt)) {
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

function formatGroupDescription(
  ref: string,
  alts: string[],
  info?: Record<string, unknown>,
): string {
  if (alts.every(isSymbolic)) {
    const svlenArr = Array.isArray(info?.SVLEN) ? info.SVLEN : undefined
    return alts
      .map((a, i) => {
        if (
          a === '<TRA>' &&
          Array.isArray(info?.CHR2) &&
          Array.isArray(info.END)
        ) {
          return `<TRA> ${info.CHR2[0]}:${info.END[0]}`
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

function findSOTerm(alt: string, parser: VCF): string | undefined {
  if (alt in altTypeToSO) {
    return altTypeToSO[alt]
  }
  // integer copy-number alleles <CN0>, <CN1>, ... emitted by 1000 Genomes,
  // gnomAD-SV, and dbVar for multiallelic CNVs
  if (/^<CN\d+>$/.test(alt)) {
    return 'copy_number_variation'
  }
  if (parser.getMetadata('ALT', alt)) {
    return 'sequence_variant'
  }
  // Try parent term by stripping last component, e.g. '<INS:ME>' -> '<INS>'
  const parts = alt.slice(1, -1).split(':')
  return parts.length > 1
    ? findSOTerm(`<${parts.slice(0, -1).join(':')}>`, parser)
    : undefined
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
