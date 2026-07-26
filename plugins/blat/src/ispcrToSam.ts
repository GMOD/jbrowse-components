import { revcom } from '@jbrowse/core/util'

import { productFootprints } from './ispcrQuery.ts'

import type { PcrProduct } from './ispcrQuery.ts'

/**
 * A PCR product has the same shape as a paired-end read: two short oriented
 * footprints pointing at each other, with an unsequenced insert between them.
 * So each product becomes a read pair — the primers are the mates, the amplicon
 * interior is the insert, and TLEN is the product size, which is the band the
 * bench sees on a gel. Shown in an alignments track with view-as-pairs on, that
 * draws the arrows-facing-inward glyph a primer pair is always drawn as, and it
 * comes with the pairing machinery (insert-size sort and color) already attached.
 *
 * The other thing the pair buys is primer *quality*: hgPcr accepts imperfect
 * matches, and a mismatch near a primer's 3' end is a real reason an
 * amplification fails. SEQ carries the primer's own bases in reference
 * orientation, so the pileup marks every base that disagrees with the template
 * rather than leaving the reader to assume a perfect anneal.
 */

// SAM FLAG bits
const PAIRED = 1
const PROPER = 2
const REVERSE = 16
const MATE_REVERSE = 32
const FIRST = 64
const SECOND = 128

// BLAT and hgPcr both report a match, not a mapping probability, so a MAPQ here
// would be invented; 255 is the spec's "unavailable".
const MAPQ = 255

function samLine(fields: (string | number)[]) {
  return fields.join('\t')
}

/**
 * The two mates of one product. Names are per-product and unique: two products
 * sharing a QNAME would be read as one pair spanning both of them.
 */
function productToSamLines(product: PcrProduct) {
  const { refName, start, end, strand } = product
  const { low, high } = productFootprints(product)
  const size = end - start
  const lowPos = low.start + 1
  const highPos = high.start + 1
  const qName = `${refName}:${lowPos}-${end}_${size}bp`
  // the forward primer is read 1, which is at the low end of a plus product and
  // the high end of a minus one
  const lowIsForward = strand === 1

  return [
    samLine([
      qName,
      PAIRED | PROPER | MATE_REVERSE | (lowIsForward ? FIRST : SECOND),
      refName,
      lowPos,
      MAPQ,
      `${low.primer.length}M`,
      '=',
      highPos,
      size,
      // a footprint at the low end matches the plus strand as submitted
      low.primer,
      '*',
    ]),
    samLine([
      qName,
      PAIRED | PROPER | REVERSE | (lowIsForward ? SECOND : FIRST),
      refName,
      highPos,
      MAPQ,
      `${high.primer.length}M`,
      '=',
      lowPos,
      -size,
      // SEQ is always reference-forward, and the high footprint's primer anneals
      // to the other strand, so it is stored reverse-complemented
      revcom(high.primer),
      '*',
    ]),
  ]
}

/**
 * A set of hgPcr products as SAM text, ready to hand a SamAdapter as `samText`.
 *
 * No `@SQ` lines: hgPcr's page states no chromosome sizes, and inventing one
 * would be a lie the adapter then reports as the reference length. A headerless
 * SAM takes its reference names from the records instead.
 */
export function ispcrToSam(products: PcrProduct[]) {
  return ['@HD\tVN:1.6', ...products.flatMap(productToSamLines), ''].join('\n')
}
