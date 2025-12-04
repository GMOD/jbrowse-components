import { parseBreakend } from '@gmod/vcf'
import { getBpDisplayStr } from '@jbrowse/core/util'

import type VCF from '@gmod/vcf'

const genotypeDelimRegex = /[/|]/

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

function isInversion(ref: string, alt: string) {
  return ref.split('').reverse().join('') === alt
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
): string[] {
  if (!alt || alt.length === 0) {
    return ['remark', 'no alternative alleles']
  }

  // Group alts by SO term
  const grouped = new Map<string, string[]>()
  for (const a of alt) {
    const soTerm = getSOTerm(a, ref, parser)
    const alts = grouped.get(soTerm) ?? []
    alts.push(a)
    grouped.set(soTerm, alts)
  }

  // Generate combined description for each group
  const soTerms: string[] = []
  const descriptions: string[] = []
  for (const [soTerm, alts] of grouped) {
    soTerms.push(soTerm)
    descriptions.push(formatGroupDescription(soTerm, ref, alts))
  }

  return [soTerms.join(','), descriptions.join(',')]
}

function getSOTerm(alt: string, ref: string, parser: VCF): string {
  // Symbolic alleles
  if (alt.startsWith('<')) {
    return findSOTerm(alt, parser) ?? 'variant'
  }

  // Breakends
  if (isBreakend(alt) && parseBreakend(alt)) {
    return 'breakend'
  }

  const lenRef = ref.length
  const lenAlt = alt.length

  if (lenRef === 1 && lenAlt === 1) {
    return 'SNV'
  }
  if (lenRef === lenAlt) {
    return isInversion(ref, alt) ? 'inv' : 'substitution'
  }
  return lenRef < lenAlt ? 'ins' : 'del'
}

function formatGroupDescription(
  soTerm: string,
  ref: string,
  alts: string[],
): string {
  if (alts.every(isSymbolic)) {
    return alts.join(',')
  }

  const lenRef = ref.length
  const isLong = lenRef > 5 || alts.some(a => a.length > 5)

  if (!isLong) {
    return `${soTerm} ${ref} -> ${alts.join(',')}`
  }

  switch (soTerm) {
    case 'substitution':
    case 'inv':
      return `${soTerm} ${getBpDisplayStr(lenRef)} -> ${alts.map(a => getBpDisplayStr(a.length)).join(',')}`

    case 'ins':
      return alts.map(a => `${getBpDisplayStr(a.length - lenRef)} INS`).join(',')

    case 'del':
      return alts.map(a => `${getBpDisplayStr(lenRef - a.length)} DEL`).join(',')

    default:
      return alts.join(',')
  }
}

function findSOTerm(alt: string, parser: VCF): string | undefined {
  if (altTypeToSO[alt]) {
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

export function getSOAndDescFromAltDefs(alt: string, parser: VCF): string[] {
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

  const lenRef = ref.length
  const lenAlt = alt.length
  const isLong = lenRef > 5 || lenAlt > 5

  if (lenRef === lenAlt) {
    const soTerm = isInversion(ref, alt) ? 'inv' : 'substitution'
    return isLong
      ? `${soTerm} ${getBpDisplayStr(lenRef)} -> ${getBpDisplayStr(lenAlt)}`
      : `${soTerm} ${ref} -> ${alt}`
  }

  if (lenRef < lenAlt) {
    return isLong
      ? `${getBpDisplayStr(lenAlt - lenRef)} INS`
      : `ins ${ref} -> ${alt}`
  }

  return isLong
    ? `${getBpDisplayStr(lenRef - lenAlt)} DEL`
    : `del ${ref} -> ${alt}`
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
        : +r === 0
          ? `ref(${ref.length < 10 ? ref : getBpDisplayStr(ref.length)})`
          : getMinimalDesc(ref, alt[+r - 1] || ''),
    )
    .join(genotype.includes('|') ? '|' : '/')
}
