import { toMafStatus } from './mafStatus.ts'
import { parseStrand } from './parseStrand.ts'

import type { AlignmentRecord, EmptyRecord } from '../types.ts'
import type { SourceResolver } from './parseAssemblyName.ts'

/**
 * The line grammar of a MAF stanza, shared by the two readers of it: bigMaf
 * packs the lines `;`-joined into one bigBed field (`parseBigMafStanza`), a
 * bgzip MAF holds them newline-separated in the file itself (`parseMafBlocks`).
 * Only the framing differs — `a` lines and blank-line terminators exist in the
 * file and not in the packed field — so the framing stays with each reader and
 * the per-line field parsing lives here.
 *
 * Keeping them apart is what let the two drift: the bgzip reader read `s` lines
 * alone, so a `.maf.gz` lost the bridged rows (`e`) the empty-line overlay draws
 * and the left/right context (`i`) the hover tooltip shows, while the *same
 * alignment* published as a bigMaf had both. The other direction had a bug of
 * its own — the bigMaf reader trusted field 7 to exist, so a truncated `s` line
 * gave a row an `undefined` sequence and took down the whole region fetch inside
 * the packer.
 */

/** Any run of whitespace: UCSC's MAF is space-aligned, taffy/Cactus (and so
 *  HPRC's) is tab-separated, and bigMaf's packed field is single-spaced. */
const WHITESPACE_REGEX = /\s+/

/**
 * `s src start size strand srcSize text` — one aligned row. `src` is the
 * unresolved source token (`genome.chr`), because the *first* `s` line fixes the
 * block's genomic extent whether or not the sample filter keeps its row.
 */
export interface MafSourceLine {
  src: string
  start: number
  size: number
  strand: number
  srcSize: number
  seq: string
}

/** The rows a stanza accumulates, keyed by resolved sample id. */
export interface MafStanzaRows {
  alignments: Record<string, AlignmentRecord>
  empties: Record<string, EmptyRecord>
}

/**
 * Apply one MAF line to `out`, returning the parsed `s` line when it was one.
 *
 * The return value is the reference hook: a caller takes the block's extent from
 * the first `s` line it sees, and gets it here *before* `resolve` runs, so a
 * reference filtered out of the sample set still positions the block.
 *
 * Line types other than `s`/`i`/`e` (`q`, `a`, `#`, blank) are ignored — this
 * view has nothing to draw for them. A malformed line is skipped rather than
 * half-applied: `s` needs all seven fields, `e` needs a recognized status
 * character, and `i` needs a row already in `alignments` to attach to.
 */
export function applyMafLine(
  line: string,
  resolve: SourceResolver,
  out: MafStanzaRows,
): MafSourceLine | undefined {
  const trimmed = line.trim()
  const type = trimmed[0]
  if (type !== 's' && type !== 'i' && type !== 'e') {
    return undefined
  }
  const parts = trimmed.split(WHITESPACE_REGEX)
  const src = parts[1]
  if (src === undefined) {
    return undefined
  }
  if (type === 's') {
    const seq = parts[6]
    if (seq === undefined) {
      // A byte-range read cuts its last line mid-field, and a hand-edited file
      // can simply be short one. Either way the row has no sequence: dropping
      // it is what the bgzip reader always did, and what stops the packer's
      // `seq.length` from throwing on `undefined` for the bigMaf one.
      return undefined
    }
    const parsed: MafSourceLine = {
      src,
      start: Number.parseInt(parts[2]!, 10),
      size: Number.parseInt(parts[3]!, 10),
      strand: parseStrand(parts[4]),
      srcSize: Number.parseInt(parts[5]!, 10),
      seq,
    }
    const resolved = resolve(src)
    if (resolved?.assemblyName) {
      out.alignments[resolved.assemblyName] = {
        chr: resolved.chr,
        start: parsed.start,
        seq,
        strand: parsed.strand,
        srcSize: parsed.srcSize,
      }
    }
    return parsed
  }
  if (type === 'i') {
    // i src leftStatus leftCount rightStatus rightCount — context for the row it
    // NAMES, resolved through the same `resolve` as the `s` and `e` lines. This
    // used to attach to whichever `s` line came last, which is the same row on
    // well-formed UCSC output but silently misattaches one species' context to
    // another the moment a stanza carries `i` lines for only some of its rows,
    // or lists them apart from their `s` lines. The `i` line names its own src,
    // so there is nothing to infer from order.
    const assemblyName = resolve(src)?.assemblyName
    const rec = assemblyName ? out.alignments[assemblyName] : undefined
    if (rec) {
      rec.context = {
        leftStatus: toMafStatus(parts[2]),
        leftCount: Number.parseInt(parts[3]!, 10),
        rightStatus: toMafStatus(parts[4]),
        rightCount: Number.parseInt(parts[5]!, 10),
      }
    }
    return undefined
  }
  // e src start size strand srcSize status
  const status = toMafStatus(parts[6])
  const resolved = resolve(src)
  if (resolved?.assemblyName && status) {
    out.empties[resolved.assemblyName] = {
      chr: resolved.chr,
      start: Number.parseInt(parts[2]!, 10),
      size: Number.parseInt(parts[3]!, 10),
      strand: parseStrand(parts[4]),
      srcSize: Number.parseInt(parts[5]!, 10),
      status,
    }
  }
  return undefined
}
