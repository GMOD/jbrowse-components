import { DASH } from '@jbrowse/core/util/alignedBytes'

import type { MafBlockSink } from '../util/mafBlockSink.ts'
import type { KeepBlock, MafStanzaReader } from '../util/mafStanzaReader.ts'
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
}

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

const TAGS = /(?:^| )@/

/**
 * `s` up to its `@` tags, which open the section or follow a space: a
 * coordinate line whose rows are unchanged writes ` ; @ tags`, leaving the
 * instruction list starting at the `@`.
 */
export function withoutTags(s: string) {
  const at = TAGS.exec(s)?.index
  return at === undefined ? s : s.slice(0, at)
}

/** Strip optional `@tags`, trim, then RLE-decode if needed. */
export function parseBasesColumn(
  s: string,
  runLengthEncodeBases: boolean,
): string {
  return parseBases(withoutTags(s).trim(), runLengthEncodeBases)
}

// ` ; ` on a coordinate line carrying instructions, and a bare trailing ` ;` on
// one that carries none.
const COORDINATE_SEPARATOR = / ; | ;$/

/**
 * Where a TAF line's coordinate section starts, or -1 for a plain bases line.
 *
 * The separator is ` ; `, except that taffy also starts a block whose rows are
 * unchanged from the previous one, and there it writes the `;` as the line's
 * last character with no instructions after it. HPRC release 2 carries two of
 * those inside the C4 window alone. Read as a bases line instead, the `;`
 * reaches `parseBases` as a base with no count — which the RLE decoder now
 * rejects rather than skipping, so a whole track failed to load — and the block
 * boundary the line states is lost.
 *
 * A coordinate line the byte range cut mid-instruction cannot be confused with
 * one of these: the caller drops an unterminated final line before it gets
 * here.
 */
export function findCoordinateSeparator(line: string) {
  return COORDINATE_SEPARATOR.exec(line)?.index ?? -1
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
  const block: AlignmentBlock = { rows: [] }

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
 * A finalized block into `sink` through `reader`: the first row is the
 * reference and fixes the span, every row resolves to its sample. Nothing for
 * a block with no rows; `BgzipTaffyAdapter` finalizes only a block with columns.
 */
export function readTafBlock(
  block: AlignmentBlock,
  reader: MafStanzaReader,
  sink: MafBlockSink,
  keep: KeepBlock,
) {
  if (block.rows.length === 0) {
    return false
  }
  reader.begin()
  const row0 = block.rows[0]!
  reader.reference(
    row0.sequenceName,
    row0.start,
    row0.length,
    row0.strand,
    row0.sequenceLength,
    row0.bases,
  )
  for (const row of block.rows) {
    const parsed = reader.resolve(row.sequenceName)
    if (parsed?.assemblyName) {
      reader.addRow(
        parsed.assemblyName,
        parsed.refName,
        row.start,
        row.length,
        row.strand,
        row.sequenceLength,
        row.bases,
      )
    }
  }
  return reader.emitPlaced(sink, keep)
}
