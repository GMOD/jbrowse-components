import { toMafStatus } from './mafStatus.ts'

import type { ParsedAssemblyName } from './parseAssemblyName.ts'
import type { AlignmentRecord, EmptyRecord } from '../types.ts'

const WHITESPACE_REGEX = / +/

export interface ParsedMafStanza {
  alignments: Record<string, AlignmentRecord>
  empties: Record<string, EmptyRecord>
  referenceSeq: string
}

type Resolver = (organismChr: string) => ParsedAssemblyName | undefined

const strandOf = (s: string | undefined) => (s === '-' ? -1 : 1)

/**
 * Parse one bigMaf stanza (the ';'-joined `mafBlock` field) into aligned rows
 * (`s` lines, with strand/srcSize and any following `i`-line context) and
 * bridged/empty rows (`e` lines). `q` lines are ignored. The reference sequence
 * is the first `s` line. `resolve` maps a `genome.chr` token to a sample id.
 */
export function parseBigMafStanza(
  maf: string,
  resolve: Resolver,
): ParsedMafStanza {
  const alignments: Record<string, AlignmentRecord> = {}
  const empties: Record<string, EmptyRecord> = {}
  let referenceSeq: string | undefined
  let lastAlignmentAssembly: string | undefined

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
          strand: strandOf(parts[4]),
          srcSize: parseInt(parts[5]!, 10),
        }
        lastAlignmentAssembly = parsed.assemblyName
      } else {
        lastAlignmentAssembly = undefined
      }
    } else if (type === 'i') {
      // i src leftStatus leftCount rightStatus rightCount — attaches to the
      // immediately preceding s line.
      const rec = lastAlignmentAssembly
        ? alignments[lastAlignmentAssembly]
        : undefined
      if (rec) {
        const parts = block.split(WHITESPACE_REGEX)
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
          strand: strandOf(parts[4]),
          srcSize: parseInt(parts[5]!, 10),
          status,
        }
      }
    }
  }

  return { alignments, empties, referenceSeq: referenceSeq ?? '' }
}
