import { toMafStatus } from './mafStatus.ts'
import { parseStrand } from './parseStrand.ts'

import type { AlignmentRecord, EmptyRecord } from '../types.ts'
import type { ParsedAssemblyName } from './parseAssemblyName.ts'

const WHITESPACE_REGEX = / +/

export interface ParsedMafStanza {
  alignments: Record<string, AlignmentRecord>
  empties: Record<string, EmptyRecord>
  referenceSeq: string
}

type Resolver = (organismChr: string) => ParsedAssemblyName | undefined

/**
 * Parse one bigMaf stanza (the ';'-joined `mafBlock` field) into aligned rows
 * (`s` lines, with strand/srcSize and their `i`-line context) and bridged/empty
 * rows (`e` lines). `q` lines are ignored. The reference sequence is the first
 * `s` line — taken before `resolve`, since a reference filtered out of the
 * sample set still defines the block's genomic extent. `resolve` maps a
 * `genome.chr` token to a sample id, and every line type goes through it, so
 * line order carries no meaning here.
 */
export function parseBigMafStanza(
  maf: string,
  resolve: Resolver,
): ParsedMafStanza {
  const alignments: Record<string, AlignmentRecord> = {}
  const empties: Record<string, EmptyRecord> = {}
  let referenceSeq: string | undefined

  for (const rawBlock of maf.split(';')) {
    const block = rawBlock.trim()
    const type = block[0]
    if (type === 's') {
      const parts = block.split(WHITESPACE_REGEX)
      const sequence = parts[6]!
      referenceSeq ??= sequence
      const parsed = resolve(parts[1]!)
      if (parsed?.assemblyName) {
        alignments[parsed.assemblyName] = {
          chr: parsed.chr,
          start: parseInt(parts[2]!, 10),
          seq: sequence,
          strand: parseStrand(parts[4]),
          srcSize: parseInt(parts[5]!, 10),
        }
      }
    } else if (type === 'i') {
      // i src leftStatus leftCount rightStatus rightCount — context for the
      // row it NAMES, resolved through the same `resolve` as the `s` and `e`
      // lines. This used to attach to whichever `s` line came last, which is
      // the same row on well-formed UCSC output but silently misattaches one
      // species' context to another the moment a stanza carries `i` lines for
      // only some of its rows, or lists them apart from their `s` lines. The
      // `i` line names its own src, so there is nothing to infer from order.
      const parts = block.split(WHITESPACE_REGEX)
      const assemblyName = resolve(parts[1]!)?.assemblyName
      const rec = assemblyName ? alignments[assemblyName] : undefined
      if (rec) {
        rec.context = {
          leftStatus: toMafStatus(parts[2]),
          leftCount: parseInt(parts[3]!, 10),
          rightStatus: toMafStatus(parts[4]),
          rightCount: parseInt(parts[5]!, 10),
        }
      }
    } else if (type === 'e') {
      // e src start size strand srcSize status
      const parts = block.split(WHITESPACE_REGEX)
      const status = toMafStatus(parts[6])
      const parsed = resolve(parts[1]!)
      if (parsed?.assemblyName && status) {
        empties[parsed.assemblyName] = {
          chr: parsed.chr,
          start: parseInt(parts[2]!, 10),
          size: parseInt(parts[3]!, 10),
          strand: parseStrand(parts[4]),
          srcSize: parseInt(parts[5]!, 10),
          status,
        }
      }
    }
  }

  return { alignments, empties, referenceSeq: referenceSeq ?? '' }
}
