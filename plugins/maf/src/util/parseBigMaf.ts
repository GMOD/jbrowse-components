import { applyMafLine } from './mafLines.ts'

import type { AlignmentRecord, EmptyRecord } from '../types.ts'
import type { SourceResolver } from './parseAssemblyName.ts'

export interface ParsedMafStanza {
  alignments: Record<string, AlignmentRecord>
  empties: Record<string, EmptyRecord>
  referenceSeq: string
}

/**
 * Parse one bigMaf stanza (the ';'-joined `mafBlock` field) into aligned rows
 * (`s` lines, with strand/srcSize and their `i`-line context) and bridged/empty
 * rows (`e` lines). `q` lines are ignored. The reference sequence is the first
 * `s` line — taken before `resolve`, since a reference filtered out of the
 * sample set still defines the block's genomic extent. `resolve` maps a
 * `genome.chr` token to a sample id, and every line type goes through it, so
 * line order carries no meaning here.
 *
 * The per-line field parsing is `applyMafLine`, shared with the bgzip MAF
 * reader: bigMaf packs the very same lines, so the only thing that belongs here
 * is the `;` framing and picking the reference row out of the first `s`.
 */
export function parseBigMafStanza(
  maf: string,
  resolve: SourceResolver,
): ParsedMafStanza {
  const rows = { alignments: {}, empties: {} }
  let referenceSeq: string | undefined
  for (const line of maf.split(';')) {
    // Called unconditionally, then the reference taken from the result: folding
    // it into `referenceSeq ??= applyMafLine(...)` short-circuits the call once
    // the first `s` line has landed, so every later row of the stanza is lost.
    const s = applyMafLine(line, resolve, rows)
    referenceSeq ??= s?.seq
  }
  return { ...rows, referenceSeq: referenceSeq ?? '' }
}
