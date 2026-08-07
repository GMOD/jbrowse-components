import { buildHeaderRemap } from '../VariantRPC/computeSampleInfo.ts'
import { hasProcessFormatFields } from './hasProcessGenotypes.ts'

import type { Feature } from '@jbrowse/core/util'

const DOT = 46
const MINUS = 45
const ZERO = 48
const NINE = 57

/**
 * Numeric value of a PS field reported as a range, or NaN when the token isn't
 * a plain integer.
 *
 * NaN rather than a thrown or skipped value because that is what the path this
 * replaced produced: `SAMPLES()` coerces a field whose FORMAT Type is Integer
 * with `+`, so a malformed phase-set id arrived as NaN, and `getPhasedColor`
 * reads it back through `Number.isFinite` and paints hue 0. Matching that keeps
 * a malformed file rendering exactly as it did.
 */
function readIntFromRange(str: string, start: number, end: number) {
  if (end <= start) {
    return Number.NaN
  }
  let i = start
  let sign = 1
  if (str.charCodeAt(i) === MINUS) {
    sign = -1
    i++
  }
  if (i === end) {
    return Number.NaN
  }
  let n = 0
  for (; i < end; i++) {
    const c = str.charCodeAt(i)
    if (c < ZERO || c > NINE) {
      return Number.NaN
    }
    n = n * 10 + (c - ZERO)
  }
  return sign * n
}

/**
 * Per-sample phase sets for the cell loops, read without materializing them.
 *
 * Phase-set coloring used to reach PS through `feature.get('samples')`, which
 * parses *every* FORMAT field of every sample — an object and an array apiece —
 * to get at one. On a 100-sample phased long-read callset over 2k variants that
 * is 343ms and 239MB per fetch, against 33ms and 4MB for the two-field range
 * walk here; at 500 samples it is 1686ms and 1.17GB against 113ms and 4MB.
 *
 * Shared by both cell loops rather than written twice: the regular and matrix
 * displays paint the same phase sets from the same records, and a second copy
 * of the absent/malformed rules is how they start disagreeing.
 *
 * GT is deliberately NOT read here. The loops already hold the interned
 * genotype codes, and taking GT from `samples` on one path and from the codes
 * on the other was the divergence the old comment in computeVariantMatrixCells
 * was already uneasy about.
 */
export function makePhaseSetReader(sampleNames: string[]) {
  const numSamples = sampleNames.length
  const columnByName = new Map<string, number>()
  for (let i = 0; i < numSamples; i++) {
    columnByName.set(sampleNames[i]!, i)
  }
  // Indexed by canonical column. `present` is separate from the value because
  // the two absent spellings mean different things downstream: no PS field at
  // all (or '.') falls back to allele coloring, while a present-but-malformed
  // one is a phase set whose hue resolves to 0.
  const value = new Float64Array(numSamples)
  const present = new Uint8Array(numSamples)
  let lastHeaderNames: string[] | undefined
  let lastRemap: Int32Array | undefined

  return {
    value,
    present,
    /**
     * Fill `value`/`present` for one feature, returning false when the feature
     * can't report FORMAT ranges — a non-VCF adapter — in which case the caller
     * paints by allele, which is what an absent `samples` field already did.
     */
    read(feature: Feature) {
      if (!hasProcessFormatFields(feature) || numSamples === 0) {
        return false
      }
      present.fill(0)
      // `sampleIdx` counts against this feature's own header, not the canonical
      // union — the same trap the genotype pass hit. Rebuilt only when the
      // header array identity changes, and `undefined` when the two orders
      // already agree.
      const headerNames = feature.get('sampleNames') as string[] | undefined
      if (headerNames !== lastHeaderNames) {
        lastHeaderNames = headerNames
        lastRemap = buildHeaderRemap(headerNames, columnByName)
      }
      const remap = lastRemap
      feature.processFormatFields(['PS'], (str, ranges, sampleIdx) => {
        const column = remap === undefined ? sampleIdx : remap[sampleIdx]!
        if (column < 0 || column >= numSamples) {
          return
        }
        const start = ranges[0]!
        const end = ranges[1]!
        // -1 is "this sample has no PS column"; an empty field and '.' are the
        // file spelling the same thing. All three fall back to allele coloring,
        // matching what `SAMPLES()` handed back as undefined.
        if (
          start === -1 ||
          end <= start ||
          (end - start === 1 && str.charCodeAt(start) === DOT)
        ) {
          return
        }
        value[column] = readIntFromRange(str, start, end)
        present[column] = 1
      })
      return true
    },
  }
}
