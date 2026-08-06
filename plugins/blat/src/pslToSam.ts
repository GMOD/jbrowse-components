import { revcom } from '@jbrowse/core/util'

import type { PslRow } from './blatQuery.ts'

/**
 * PSL states a hit as a list of aligned blocks in both query and target
 * coordinates, which is exactly the information a CIGAR encodes: each block is
 * an M run, the target gap between two blocks is a D, the query gap an I, and
 * the unaligned query ends are soft clips.
 *
 * D rather than N for every target gap: a DNA BLAT hit cannot tell an intron
 * from a deletion (a spliced-mRNA query would want N, a diverged genomic query
 * D), and psl2sam takes the same position. The gap is drawn either way.
 *
 * Coordinates are the ones PSL states, which for a `-` strand hit means
 * `blockSizes`/`qStarts` are in reverse-complement query space — the same space
 * as the SEQ a reverse-strand SAM record carries. That correspondence is what
 * makes the soft clips and the per-base mismatches land in the right place, so
 * {@link pslQuerySeq} reverse-complements to match.
 */
export function pslToCigar({
  blockSizes,
  qStarts,
  tStarts,
  qSize,
}: {
  blockSizes: number[]
  qStarts: number[]
  tStarts: number[]
  qSize: number
}) {
  // a row stating no blocks describes no alignment; '*' is SAM's word for that,
  // where the empty string the loop would otherwise build is an unparseable
  // CIGAR column
  if (!blockSizes.length) {
    return '*'
  }
  const ops: string[] = []
  const leadingClip = qStarts[0] ?? 0
  if (leadingClip > 0) {
    ops.push(`${leadingClip}S`)
  }
  for (let i = 0; i < blockSizes.length; i++) {
    if (i > 0) {
      const queryGap = qStarts[i]! - (qStarts[i - 1]! + blockSizes[i - 1]!)
      const targetGap = tStarts[i]! - (tStarts[i - 1]! + blockSizes[i - 1]!)
      if (queryGap > 0) {
        ops.push(`${queryGap}I`)
      }
      if (targetGap > 0) {
        ops.push(`${targetGap}D`)
      }
    }
    ops.push(`${blockSizes[i]!}M`)
  }
  const last = blockSizes.length - 1
  const trailingClip = qSize - (qStarts[last]! + blockSizes[last]!)
  if (trailingClip > 0) {
    ops.push(`${trailingClip}S`)
  }
  return ops.join('')
}

/**
 * The submitted query in the orientation the hit aligned it, which is what SAM's
 * SEQ column holds. Answers "do I have the bases this row describes", so it
 * checks the length the row states as well as the name: the CIGAR spans `qSize`
 * query bases by construction, and bases of any other length would sit out of
 * register against the reference, drawing mismatches the whole way along a hit
 * BLAT scored as near-perfect. Returns undefined for both misses, and the record
 * then carries `*` and renders its block structure without per-base mismatches.
 */
export function pslQuerySeq(row: PslRow, querySequences: Map<string, string>) {
  const seq =
    querySequences.get(row.qName) ??
    // hgBlat labels a headerless query "YourSeq"; a single submitted record is
    // unambiguously the one every hit came from whatever it ended up named
    (querySequences.size === 1 ? [...querySequences.values()][0]! : undefined)
  return seq?.length === row.qSize
    ? row.strand < 0
      ? revcom(seq)
      : seq
    : undefined
}

// Kent's psl2sam: the edit distance is the mismatched bases plus the bases
// inserted on either side.
function editDistance(row: PslRow) {
  return row.misMatches + row.qBaseInsert + row.tBaseInsert
}

/**
 * One SAM alignment line per PSL row. `bestOf` names the queries whose leading
 * hit has already been emitted: BLAT returns every placement of a query, and
 * all but its best are secondary alignments (0x100) — competing mappings of one
 * sequence, which is what keeps them off the best hit's row in the pileup.
 * MAPQ is 255, the spec's "unavailable": BLAT reports identity, not a mapping
 * probability, so any number here would be invented.
 */
function pslRowToSamLine(
  row: PslRow,
  querySequences: Map<string, string>,
  bestOf: Set<string>,
) {
  const secondary = bestOf.has(row.qName)
  bestOf.add(row.qName)
  const seq = pslQuerySeq(row, querySequences)
  return [
    row.qName,
    (row.strand < 0 ? 16 : 0) | (secondary ? 256 : 0),
    row.tName,
    row.tStart + 1,
    255,
    pslToCigar(row),
    '*',
    0,
    0,
    seq ?? '*',
    '*',
    `NM:i:${editDistance(row)}`,
    `AS:i:${row.score}`,
  ].join('\t')
}

/**
 * A PSL result set as SAM text, ready to hand to a SamAdapter as `samText`.
 * `@SQ` lines come from the target sizes PSL already states, so the track knows
 * its reference names without consulting the assembly.
 *
 * Rows arrive best-first (pslToFeatures sorts by score), which is what decides
 * each query's primary alignment.
 */
export function pslToSam(
  rows: PslRow[],
  querySequences: Map<string, string>,
): string {
  const targetSizes = new Map(rows.map(row => [row.tName, row.tSize]))
  const bestOf = new Set<string>()
  return [
    '@HD\tVN:1.6',
    ...[...targetSizes].map(([name, size]) => `@SQ\tSN:${name}\tLN:${size}`),
    ...rows.map(row => pslRowToSamLine(row, querySequences, bestOf)),
    '',
  ].join('\n')
}

/**
 * The submitted query text as name -> residues. hgBlat places each FASTA record
 * separately and labels its hits with that record's name, so this is the map
 * from a hit back to the bases it was made of.
 *
 * Keeps only letters, which is what Kent's FASTA reader counts: a pasted
 * sequence carrying line numbers, or alignment-gap dashes, is those bases to
 * BLAT and so `qSize` excludes them. Stripping only whitespace left our text
 * longer than the hit it describes, which is exactly the off-by-N that puts
 * every base out of register.
 */
export function parseQuerySequences(text: string) {
  const sequences = new Map<string, string>()
  let name = 'YourSeq'
  let residues: string[] = []
  const flush = () => {
    if (residues.length) {
      sequences.set(name, residues.join(''))
    }
  }
  for (const line of text.split('\n')) {
    if (line.startsWith('>')) {
      flush()
      name = /^>\s*(\S+)/.exec(line)?.[1] ?? 'YourSeq'
      residues = []
    } else {
      residues.push(line.replaceAll(/[^A-Za-z]/g, ''))
    }
  }
  flush()
  return sequences
}
