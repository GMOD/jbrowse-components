import { DASH } from '../util/asciiBytes.ts'
import { flipBlockToForwardStrand } from '../util/forwardStrandBlock.ts'

import type { AlignmentRecord } from '../types.ts'
import type { SourceResolver } from '../util/parseAssemblyName.ts'
import type { TaiBlockFeature } from '../util/taiBlockFeatures.ts'
import type { RowInstruction } from './rowInstructions.ts'

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

/**
 * A parsed TAF block, which is the shared `.tai` block shape exactly — TAF has
 * no `e` line, so it never carries `empties`.
 */
export type TafFeature = TaiBlockFeature

/**
 * Decode RLE-encoded bases ("A 3 T 2" → "AAATT") or pass through plain bases.
 *
 * Throws on a malformed `base count` pair, for the reason `parseRowInstructions`
 * throws on an unknown opcode: a decoded column is read *positionally* —
 * `finalizeBlock` takes row `j`'s base from character `j` of every column — so
 * dropping a bad pair shortens the string and hands every row below it a base
 * belonging to a different species. Skipping made that silent, and silently
 * wrong bases at real coordinates are the worst answer this file can give.
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
      const count = Number.parseInt(tokens[i + 1]!, 10)
      if (Number.isNaN(count) || base.length !== 1) {
        throw new Error(
          `Malformed run-length-encoded TAF column: expected \`base count\` pairs, got ${JSON.stringify(basesStr)}`,
        )
      }
      parts.push(base.repeat(count))
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
 * Build a TafFeature from a finalized block, dropping rows the caller's
 * `makeSourceResolver` doesn't resolve. Reference row (`row0`) determines
 * the feature's genomic span; alignments are keyed by assembly name.
 */
export function blockToFeature(
  block: AlignmentBlock,
  resolve: SourceResolver,
): TafFeature | undefined {
  if (block.rows.length === 0 || block.columnNumber === 0) {
    return undefined
  }

  const row0 = block.rows[0]!
  const alignments: Record<string, AlignmentRecord> = {}

  for (const row of block.rows) {
    const parsed = resolve(row.sequenceName)
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

  // A `-` reference row counts from the reverse complement of its source, so
  // the block is turned over before anything reads its extent — the MAF path
  // does the same, through the same helper. `strand` is 1 either way after it.
  const placed =
    row0.strand === -1
      ? flipBlockToForwardStrand({
          refStart: row0.start,
          refSize: row0.length,
          refSrcSize: row0.sequenceLength,
          refSeq: row0.bases,
          alignments,
        })
      : { start: row0.start, end: row0.start + row0.length, seq: row0.bases }

  return {
    // Qualified by the reference row's sequence name: `start`+`length` alone
    // repeats across chromosomes, and a feature id has to survive being read
    // outside the one region query that produced it.
    uniqueId: `${row0.sequenceName}-${placed.start}-${row0.length}`,
    refSrc: row0.sequenceName,
    start: placed.start,
    end: placed.end,
    strand: 1,
    alignments,
    seq: placed.seq,
  }
}
