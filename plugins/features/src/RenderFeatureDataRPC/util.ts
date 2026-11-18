import type { Feature } from '@jbrowse/core/util'

const MAX_LABEL_LENGTH = 50
const UTR_REGEX = /(\bUTR|_UTR|untranslated[_\s]region)\b/i

// The unit `truncateLabel` cuts on. Not UTF-16 units, which split a surrogate
// pair, and not code points, which split a combining sequence or an emoji ZWJ
// join.
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// A string of 50 or fewer UTF-16 units has at most 50 graphemes, so only a
// longer one pays for segmenting.
export function truncateLabel(text: string) {
  if (text.length > MAX_LABEL_LENGTH) {
    const chars = [...GRAPHEMES.segment(text)].map(g => g.segment)
    return chars.length > MAX_LABEL_LENGTH
      ? `${chars.slice(0, MAX_LABEL_LENGTH - 1).join('')}…`
      : text
  }
  return text
}

// A bare `/\S/.test(undefined)` coerces to the string "undefined" and wrongly
// reports visible text, so this handles nullish itself.
export function hasVisibleText(text: string | undefined): text is string {
  return text !== undefined && /\S/.test(text)
}

// The single place the optional `type` slot is defaulted.
export function featureType(feature: Feature) {
  return feature.get('type') ?? ''
}

// The single place the optional `subfeatures` slot is resolved.
export function getSubfeatures(feature: Feature): Feature[] {
  return feature.get('subfeatures') ?? []
}

export function isUTR(feature: Feature) {
  return UTR_REGEX.test(featureType(feature))
}

// Case-insensitive: GFF3 mandates uppercase `CDS`, but real-world files carry
// lowercase `cds`.
export function isCDS(feature: Feature) {
  return featureType(feature).toLowerCase() === 'cds'
}

// Case-insensitive like isCDS: matching exons case-sensitively would derive
// UTRs from only some exons.
export function isExon(feature: Feature) {
  return featureType(feature).toLowerCase() === 'exon'
}

// Three vocabularies name a cleavage product: NCBI's `*_region_of_CDS` SO
// family, the plain SO terms, and the INSDC feature keys a GenBank flatfile
// conversion emits. Compared case-insensitively, since real-world GFFs vary in
// case.
const CLEAVAGE_PRODUCT_TYPES = new Set([
  'mature_protein_region_of_cds',
  'signal_peptide_region_of_cds',
  'propeptide_region_of_cds',
  'mature_protein_region',
  'signal_peptide',
  'mat_peptide',
  'sig_peptide',
  'transit_peptide',
  'propeptide',
])

export function isCleavageProduct(feature: Feature) {
  return CLEAVAGE_PRODUCT_TYPES.has(featureType(feature).toLowerCase())
}
