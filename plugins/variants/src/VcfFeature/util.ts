import { parseBreakend } from '@gmod/vcf'
import { getBpDisplayStr } from '@jbrowse/core/util'

import type VCF from '@gmod/vcf'

const altTypeToSO: Record<string, string> = {
  DEL: 'deletion',
  INS: 'insertion',
  DUP: 'duplication',
  INV: 'inversion',
  INVDUP: 'inverted_duplication',
  CNV: 'copy_number_variation',
  TRA: 'translocation',
  'DUP:TANDEM': 'tandem_duplication',
  NON_REF: 'sequence_variant',
  '*': 'sequence_variant',
}

export function getSOTermAndDescription(
  ref: string,
  alt: string[] | undefined,
  parser: VCF,
): string[] {
  // it's just a remark if there are no alternate alleles
  if (!alt || alt.length === 0) {
    return ['remark', 'no alternative alleles']
  }

  const soTerms = new Set<string>()
  let descriptions = new Set<string>()
  for (const a of alt) {
    let [soTerm, description] = getSOAndDescFromAltDefs(a, parser)
    if (!soTerm) {
      ;[soTerm, description] = getSOAndDescByExamination(ref, a)
    }
    if (soTerm && description) {
      soTerms.add(soTerm)
      descriptions.add(description)
    }
  }

  // Combine descriptions like ["SNV G -> A", "SNV G -> T"] to ["SNV G -> A,T"]
  if (descriptions.size > 1) {
    const descs = [...descriptions]
    const prefixes = new Set(
      descs
        .map(desc => {
          const prefix = desc.split('->')
          return prefix[1] ? prefix[0] : desc
        })
        .filter((f): f is string => !!f),
    )

    descriptions = new Set(
      [...prefixes]
        .map(r => r.trim())
        .map(prefix => {
          const suffixes = descs
            .map(desc => desc.split('->').map(r => r.trim()))
            .map(pref => (pref[1] && pref[0] === prefix ? pref[1] : ''))
            .filter(f => !!f)

          return suffixes.length ? `${prefix} -> ${suffixes.join(',')}` : prefix
        }),
    )
  }
  return soTerms.size
    ? [[...soTerms].join(','), [...descriptions].join(',')]
    : []
}

export function getSOAndDescFromAltDefs(alt: string, parser: VCF): string[] {
  if (typeof alt === 'string' && !alt.startsWith('<')) {
    return []
  }

  // look for a definition with an SO type for this
  let soTerm = altTypeToSO[alt]

  // if no SO term but ALT is in metadata, assume sequence_variant
  if (!soTerm && parser.getMetadata('ALT', alt)) {
    soTerm = 'sequence_variant'
  }
  if (soTerm) {
    return [soTerm, alt]
  }

  // try to look for a definition for a parent term if we can
  const modAlt = alt.split(':')
  return modAlt.length > 1
    ? getSOAndDescFromAltDefs(`<${modAlt.slice(0, -1).join(':')}>`, parser)
    : []
}

export function getSOAndDescByExamination(ref: string, alt: string) {
  const bnd = parseBreakend(alt)
  if (bnd) {
    return ['breakend', alt]
  } else if (ref.length === 1 && alt.length === 1) {
    // note: SNV is used instead of SNP because SO definition of SNP says
    // abundance must be at least 1% in population
    return ['SNV', makeDescriptionString('SNV', ref, alt)]
  } else if (alt === '<INS>') {
    return ['insertion', alt]
  } else if (alt === '<DEL>') {
    return ['deletion', alt]
  } else if (alt === '<DUP>') {
    return ['duplication', alt]
  } else if (alt === '<CNV>') {
    return ['cnv', alt]
  } else if (alt === '<INV>') {
    return ['inversion', alt]
  } else if (alt === '<TRA>') {
    return ['translocation', alt]
  } else if (alt.includes('<')) {
    return ['sv', alt]
  } else if (ref.length === alt.length) {
    const lenRef = ref.length
    const lenAlt = alt.length
    if (lenRef > 5 || lenAlt > 5) {
      const lena = getBpDisplayStr(lenRef)
      const lenb = getBpDisplayStr(lenAlt)
      return ref.split('').reverse().join('') === alt
        ? ['inverson', makeDescriptionString('inv', lena, lenb)]
        : ['substitution', makeDescriptionString('substitution', lena, lenb)]
    } else {
      return ref.split('').reverse().join('') === alt
        ? ['inversion', makeDescriptionString('inv', ref, alt)]
        : ['substitution', makeDescriptionString('substitution', ref, alt)]
    }
  } else if (ref.length <= alt.length) {
    const len = alt.length - ref.length
    const lenAlt = alt.length
    const lenRef = ref.length
    const lena = getBpDisplayStr(len)
    return [
      'insertion',
      lenRef > 5 || lenAlt > 5
        ? `${lena} INS`
        : makeDescriptionString('insertion', len > 5 ? lena : ref, alt),
    ]
  } else if (ref.length > alt.length) {
    const lenRef = ref.length
    const lenAlt = alt.length
    const lena = getBpDisplayStr(lenRef - lenAlt)
    return [
      'deletion',
      lenRef > 5 || lenAlt > 5
        ? `${lena} DEL`
        : makeDescriptionString('deletion', ref, alt),
    ]
  } else {
    return ['indel', makeDescriptionString('indel', ref, alt)]
  }
}

export function getMinimalDesc(ref: string, alt: string) {
  const bnd = parseBreakend(alt)
  if (bnd) {
    return alt
  } else if (ref.length === 1 && alt.length === 1) {
    // note: SNV is used instead of SNP because SO definition of SNP says
    // abundance must be at least 1% in population
    return alt
  } else if (alt === '<INS>') {
    return alt
  } else if (alt === '<DEL>') {
    return alt
  } else if (alt === '<DUP>') {
    return alt
  } else if (alt === '<CNV>') {
    return alt
  } else if (alt === '<INV>') {
    return alt
  } else if (alt === '<TRA>') {
    return alt
  } else if (alt.includes('<')) {
    return alt
  } else if (ref.length === alt.length) {
    const lenRef = ref.length
    const lenAlt = alt.length
    if (lenRef > 5 || lenAlt > 5) {
      const lena = getBpDisplayStr(lenRef)
      const lenb = getBpDisplayStr(lenAlt)
      return ref.split('').reverse().join('') === alt
        ? makeDescriptionString('inv', lena, lenb)
        : makeDescriptionString('substitution', lena, lenb)
    } else {
      return ref.split('').reverse().join('') === alt
        ? makeDescriptionString('inv', ref, alt)
        : makeDescriptionString('substitution', ref, alt)
    }
  } else if (ref.length <= alt.length) {
    const len = alt.length - ref.length
    const lenAlt = alt.length
    const lenRef = ref.length
    const lena = getBpDisplayStr(len)
    return lenRef > 5 || lenAlt > 5
      ? `${lena} INS`
      : makeDescriptionString('insertion', len > 5 ? lena : ref, alt)
  } else if (ref.length > alt.length) {
    const lenRef = ref.length
    const lenAlt = alt.length
    const lena = getBpDisplayStr(lenRef - lenAlt)
    return lenRef > 5 || lenAlt > 5
      ? `${lena} DEL`
      : makeDescriptionString('deletion', ref, alt)
  } else {
    return makeDescriptionString('indel', ref, alt)
  }
}

function makeDescriptionString(soTerm: string, ref: string, alt: string) {
  return `${soTerm} ${[ref, alt].join(' -> ')}`
}

export function makeSimpleAltString(
  genotype: string,
  ref: string,
  alt: string[],
) {
  return genotype
    .split(/[/|]/)
    .map(r =>
      r === '.'
        ? '.'
        : +r === 0
          ? `ref(${ref.length < 10 ? ref : getBpDisplayStr(ref.length)})`
          : getMinimalDesc(ref, alt[+r - 1] || ''),
    )
    .join(genotype.includes('|') ? '|' : '/')
}
