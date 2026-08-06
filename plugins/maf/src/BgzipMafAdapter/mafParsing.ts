import { parseStrand } from '../util/parseStrand.ts'

import type { AlignmentRecord } from '../types.ts'
import type { SourceResolver } from '../util/parseAssemblyName.ts'

// Any run of whitespace, NOT the ` +` the bigMaf path uses. UCSC's MAF is
// space-aligned; taffy and Cactus write theirs tab-separated, and HPRC's is the
// latter. Splitting on spaces alone leaves the whole row in one field, so every
// `s` line silently fails its column check and the track draws nothing.
const WHITESPACE_REGEX = /\s+/

export interface MafBlockFeature {
  uniqueId: string
  start: number
  end: number
  strand: number
  alignments: Record<string, AlignmentRecord>
  seq: string
}

/**
 * Stream MAF alignment blocks out of a decompressed slice.
 *
 * A MAF block is an `a` line followed by `s`/`i`/`e`/`q` lines and terminated by
 * a blank line. `s src start size strand srcSize text` — the first `s` line is
 * the reference row and fixes the block's genomic extent, taken before
 * `resolve` so a reference filtered out of the sample set still positions the
 * block.
 *
 * `trailingPartial` is the one thing this has to be careful about. The read is a
 * byte range, so its last block is very often cut mid-row; emitting it would put
 * a short sequence at real coordinates, which renders as a plausible alignment
 * that is simply wrong. A block is therefore only emitted once its terminator
 * has been seen, and the final block is emitted only when the buffer ended on a
 * clean line boundary.
 */
export function* parseMafBlocks(
  text: string,
  resolve: SourceResolver,
): Generator<MafBlockFeature> {
  // A slice that does not end on a newline had its last line truncated by the
  // byte range; that line cannot be trusted, and neither can the block holding
  // it.
  const endsClean = text.endsWith('\n')
  const lines = text.split('\n')

  let alignments: Record<string, AlignmentRecord> = {}
  let refName: string | undefined
  let refStart = 0
  let refSize = 0
  let refStrand = 1
  let refSeq = ''
  let open = false

  const flush = () => {
    const done =
      open && refName !== undefined
        ? {
            // Qualified by the reference row's own name for the reason the TAF
            // path does it: start+size repeats across chromosomes, and a feature
            // id has to survive being read outside the query that produced it.
            uniqueId: `${refName}-${refStart}-${refSize}`,
            start: refStart,
            end: refStart + refSize,
            strand: refStrand,
            alignments,
            seq: refSeq,
          }
        : undefined
    alignments = {}
    refName = undefined
    refStart = 0
    refSize = 0
    refStrand = 1
    refSeq = ''
    open = false
    return done
  }

  for (const [i, raw] of lines.entries()) {
    const isLast = i === lines.length - 1
    // The final element of a split is '' when the text ended with a newline, so
    // an unterminated last line is exactly the non-empty final element.
    if (isLast && !endsClean && raw !== '') {
      break
    }
    const line = raw.trimEnd()
    if (line === '') {
      const done = flush()
      if (done) {
        yield done
      }
      continue
    }
    const type = line[0]
    if (type === '#') {
      continue
    }
    if (type === 'a') {
      const done = flush()
      if (done) {
        yield done
      }
      open = true
      continue
    }
    if (type !== 's' || !open) {
      // i/e/q lines carry context and bridged rows the bigMaf path uses; a TAF
      // or bgzip-MAF read gets its rows from `s` alone, and anything else is
      // either a comment or a line type this view has nothing to draw for.
      continue
    }
    const parts = line.split(WHITESPACE_REGEX)
    const seq = parts[6]
    if (seq === undefined) {
      continue
    }
    const src = parts[1]!
    const start = Number.parseInt(parts[2]!, 10)
    const size = Number.parseInt(parts[3]!, 10)
    const strand = parseStrand(parts[4])
    const srcSize = Number.parseInt(parts[5]!, 10)
    if (refName === undefined) {
      refName = src
      refStart = start
      refSize = size
      refStrand = strand
      refSeq = seq
    }
    const parsed = resolve(src)
    if (parsed?.assemblyName) {
      alignments[parsed.assemblyName] = {
        chr: parsed.chr,
        start,
        seq,
        strand,
        srcSize,
      }
    }
  }

  // Only when the slice ended cleanly; otherwise the open block is truncated.
  if (endsClean) {
    const done = flush()
    if (done) {
      yield done
    }
  }
}
