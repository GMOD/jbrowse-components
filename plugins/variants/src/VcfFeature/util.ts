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

/**
 * Get a sequence ontology (SO) term that describes the variant type
 */
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
  if (modAlt.length > 1) {
    return getSOAndDescFromAltDefs(`<${modAlt.slice(0, -1).join(':')}>`, parser)
  }

  // no parent
  return []
}

// note: term SNV is used instead of SNP because SO definition of SNP says
// abundance must be at least 1% in population, and can't be sure we meet
// that
export function getSOAndDescByExamination(ref: string, alt: string) {
  const bnd = parseBreakend(alt)
  if (bnd) {
    return ['breakend', alt]
  } else if (ref.length === 1 && alt.length === 1) {
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
    return ref.split('').reverse().join('') === alt
      ? ['inversion', makeDescriptionString('inversion', ref, alt)]
      : ['substitution', makeDescriptionString('substitution', ref, alt)]
  } else if (ref.length <= alt.length) {
    const len = alt.length - ref.length
    const lena = getBpDisplayStr(len)
    return [
      'insertion',
      len > 5 ? `${lena} INS` : makeDescriptionString('insertion', ref, alt),
    ]
  } else if (ref.length > alt.length) {
    const len = ref.length - alt.length
    const lena = getBpDisplayStr(len)
    return [
      'deletion',
      len > 5 ? `${lena} DEL` : makeDescriptionString('deletion', ref, alt),
    ]
  } else {
    return ['indel', makeDescriptionString('indel', ref, alt)]
  }
}

function makeDescriptionString(soTerm: string, ref: string, alt: string) {
  return `${soTerm} ${ref} -> ${alt}`
}
