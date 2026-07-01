import { DASH } from '../util/asciiBytes.ts'
import {
  matchSampleId,
  parseAssemblyAndChrSimple,
} from '../util/parseAssemblyName.ts'

import type { RowInstruction } from './rowInstructions.ts'
import type { AlignmentRecord } from '../types.ts'

// Represents a row in the alignment (like Alignment_Row in C)
export interface RowState {
  sequenceName: string
  start: number
  strand: number
  sequenceLength: number
  bases: string
  length: number
}

// Represents an alignment block (like Alignment in C)
export interface AlignmentBlock {
  rows: RowState[]
  columnNumber: number
}

export interface TafFeature {
  uniqueId: string
  start: number
  end: number
  strand: number
  alignments: Record<string, AlignmentRecord>
  seq: string
}

/**
 * Decode RLE-encoded bases ("A 3 T 2" → "AAATT") or pass through plain bases.
 */
export function parseBases(
  basesStr: string,
  runLengthEncodeBases: boolean,
): string {
  if (runLengthEncodeBases) {
    const tokens = basesStr.split(' ')
    const parts: string[] = []
    for (let i = 0; i < tokens.length; i += 2) {
      const base = tokens[i]!
      const count = parseInt(tokens[i + 1]!, 10)
      if (!Number.isNaN(count) && base.length === 1) {
        parts.push(base.repeat(count))
      }
    }
    return parts.join('')
  }
  return basesStr
}

/**
 * Strip optional ` @tags` suffix, trim, then RLE-decode if needed.
 */
export function parseBasesColumn(
  s: string,
  runLengthEncodeBases: boolean,
): string {
  const atIndex = s.indexOf(' @')
  const basesOnly = atIndex !== -1 ? s.slice(0, atIndex) : s
  return parseBases(basesOnly.trim(), runLengthEncodeBases)
}

/**
 * Faithful translation of parse_coordinates_and_establish_block from taf.c.
 * Starts from `pBlock` (advancing each row's start by its previous length)
 * and applies the per-row instruction stream.
 */
export function parseCoordinatesAndEstablishBlock(
  pBlock: AlignmentBlock | undefined,
  instructions: RowInstruction[],
): AlignmentBlock {
  const block: AlignmentBlock = {
    rows: [],
    columnNumber: 0,
  }

  if (pBlock) {
    for (const pRow of pBlock.rows) {
      block.rows.push({
        sequenceName: pRow.sequenceName,
        start: pRow.start + pRow.length,
        strand: pRow.strand,
        sequenceLength: pRow.sequenceLength,
        bases: '',
        length: 0,
      })
    }
  }

  for (const ins of instructions) {
    switch (ins.type) {
      case 'i': {
        block.rows.splice(ins.row, 0, {
          sequenceName: ins.sequenceName,
          start: ins.start,
          strand: ins.strand,
          sequenceLength: ins.sequenceLength,
          bases: '',
          length: 0,
        })
        break
      }
      case 's': {
        const row = block.rows[ins.row]
        if (row) {
          row.sequenceName = ins.sequenceName
          row.start = ins.start
          row.strand = ins.strand
          row.sequenceLength = ins.sequenceLength
        }
        break
      }
      case 'd': {
        if (block.rows[ins.row]) {
          block.rows.splice(ins.row, 1)
        }
        break
      }
      case 'g': {
        const row = block.rows[ins.row]
        if (row) {
          row.start += ins.gapLength
        }
        break
      }
      case 'G': {
        const row = block.rows[ins.row]
        if (row) {
          row.start += ins.gapSubstring.length
        }
        break
      }
    }
  }

  return block
}

/**
 * Transpose `columns` (one string per TAF column) into per-row `bases` on
 * the block. Counts non-gap bases as each row's `length`. Caller passes its
 * own `TextDecoder` (we avoid a module-scope one because constructing it at
 * import time has subtle side effects in Node.js).
 */
export function finalizeBlock(
  block: AlignmentBlock,
  columns: string[],
  decoder: TextDecoder,
) {
  const numCols = columns.length
  block.columnNumber = numCols
  const buffer = new Uint8Array(numCols)

  for (let j = 0; j < block.rows.length; j++) {
    const row = block.rows[j]!
    let length = 0
    for (let i = 0; i < numCols; i++) {
      const col = columns[i]!
      const charCode = col.charCodeAt(j)
      // Use dash if character doesn't exist (NaN from charCodeAt)
      const code = Number.isNaN(charCode) ? DASH : charCode
      buffer[i] = code
      if (code !== DASH) {
        length++
      }
    }
    row.bases = decoder.decode(buffer)
    row.length = length
  }
}

/**
 * Build a TafFeature from a finalized block, optionally filtering rows
 * whose assembly isn't in `sampleIds`. Reference row (`row0`) determines
 * the feature's genomic span; alignments are keyed by assembly name.
 */
export function blockToFeature(
  block: AlignmentBlock,
  sampleIds?: Set<string>,
): TafFeature | undefined {
  if (block.rows.length === 0 || block.columnNumber === 0) {
    return undefined
  }

  const row0 = block.rows[0]!
  const alignments: Record<string, AlignmentRecord> = {}

  for (const row of block.rows) {
    const parsed = sampleIds
      ? matchSampleId(row.sequenceName, sampleIds)
      : parseAssemblyAndChrSimple(row.sequenceName)
    if (parsed?.assemblyName) {
      alignments[parsed.assemblyName] = {
        chr: parsed.chr,
        start: row.start,
        seq: row.bases,
        strand: row.strand,
        srcSize: row.sequenceLength,
      }
    }
  }

  return {
    uniqueId: `${row0.start}-${row0.length}`,
    start: row0.start,
    end: row0.start + row0.length,
    strand: row0.strand,
    alignments,
    seq: row0.bases,
  }
}
