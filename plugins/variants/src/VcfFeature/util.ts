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
    const refReversed = ref.split('').reverse().join('')
    return refReversed === alt ? 'inv' : 'substitution'
  }
  return lenRef < lenAlt ? 'insertion' : 'deletion'
}

function formatGroupDescription(
  soTerm: string,
  ref: string,
  alts: string[],
): string {
  // For symbolic alleles and breakends, just return the alt itself
  if (alts.every(a => a.startsWith('<') || isBreakend(a))) {
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

    case 'insertion':
      return alts.map(a => `${getBpDisplayStr(a.length - lenRef)} INS`).join(',')

    case 'deletion':
      return alts.map(a => `${getBpDisplayStr(lenRef - a.length)} DEL`).join(',')

    default:
      return alts.join(',')
  }
}

function findSOTerm(alt: string, parser: VCF): string | undefined {
  // Direct lookup
  const soTerm = altTypeToSO[alt]
  if (soTerm) {
    return soTerm
  }

  // Check parser metadata
  if (parser.getMetadata('ALT', alt)) {
    return 'sequence_variant'
  }

  // Try parent term by stripping last component, e.g. '<INS:ME>' -> '<INS>'
  const inner = alt.slice(1, -1)
  const parts = inner.split(':')
  if (parts.length > 1) {
    return findSOTerm(`<${parts.slice(0, -1).join(':')}>`, parser)
  }

  return undefined
}

export function getSOAndDescFromAltDefs(alt: string, parser: VCF): string[] {
  if (!alt.startsWith('<')) {
    return []
  }

  const soTerm = findSOTerm(alt, parser)
  return [soTerm ?? 'variant', alt]
}

export function getMinimalDesc(ref: string, alt: string) {
  // Breakends, symbolic alleles, and SNVs - just return alt
  if (
    isBreakend(alt) ||
    alt.includes('<') ||
    (ref.length === 1 && alt.length === 1)
  ) {
    return alt
  }

  const lenRef = ref.length
  const lenAlt = alt.length
  const isLong = lenRef > 5 || lenAlt > 5

  // Same length - substitution or inversion
  if (lenRef === lenAlt) {
    const refReversed = ref.split('').reverse().join('')
    const isInversion = refReversed === alt
    const refStr = isLong ? getBpDisplayStr(lenRef) : ref
    const altStr = isLong ? getBpDisplayStr(lenAlt) : alt
    return isInversion
      ? makeDescriptionString('inv', refStr, altStr)
      : makeDescriptionString('substitution', refStr, altStr)
  }

  // Insertion
  if (lenRef < lenAlt) {
    const len = lenAlt - lenRef
    return isLong
      ? `${getBpDisplayStr(len)} INS`
      : makeDescriptionString(
          'insertion',
          len > 5 ? getBpDisplayStr(len) : ref,
          alt,
        )
  }

  // Deletion
  return isLong
    ? `${getBpDisplayStr(lenRef - lenAlt)} DEL`
    : makeDescriptionString('deletion', ref, alt)
}

function makeDescriptionString(soTerm: string, ref: string, alt: string) {
  return `${soTerm} ${ref} -> ${alt}`
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
