import { parseBreakend } from '@gmod/vcf'
import { getBpDisplayStr } from '@jbrowse/core/util'

import { GENOTYPE_SPLITTER as genotypeDelimRegex } from '../shared/constants.ts'

import type VCF from '@gmod/vcf'

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
        if (a === '<TRA>' && Array.isArray(info?.CHR2) && Array.isArray(info.END)) {
          return `<TRA> ${info.CHR2[0]}:${info.END[0]}`
        }
        const svlen = svlenArr?.[i]
        return svlen !== undefined ? `${a} ${getBpDisplayStr(Math.abs(+svlen))}` : a
      })
      .join(',')
  }

  const lenRef = ref.length
  const altStr = alts
    .map(a => (a.length >= 10 ? getBpDisplayStr(a.length) : a))
    .join(',')
  return `${lenRef >= 10 ? getBpDisplayStr(lenRef) : ref} -> ${altStr}`
}

function findSOTerm(alt: string, parser: VCF): string | undefined {
  if (alt in altTypeToSO) {
    return altTypeToSO[alt]
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

export function getSOAndDescFromAltDefs(
  alt: string,
  parser: VCF,
): [] | [string, string] {
  if (!alt.startsWith('<')) {
    return []
  }

  const soTerm = findSOTerm(alt, parser)
  return [soTerm ?? 'variant', alt]
}

export function getMinimalDesc(ref: string, alt: string) {
  if (isSymbolic(alt) || (ref.length === 1 && alt.length === 1)) {
    return alt
  }
  return ref.length > 5 || alt.length > 5
    ? `${getBpDisplayStr(ref.length)} -> ${getBpDisplayStr(alt.length)}`
    : `${ref} -> ${alt}`
}

export function makeSimpleAltString(
  genotype: string,
  ref: string,
  alt: string[],
) {
  return genotype
    .split(genotypeDelimRegex)
    .map(r =>
      r === '.'
        ? '.'
        : r === '0'
          ? `ref(${ref.length < 10 ? ref : getBpDisplayStr(ref.length)})`
          : getMinimalDesc(ref, alt[+r - 1] ?? ''),
    )
    .join(genotype.includes('|') ? '|' : '/')
}
