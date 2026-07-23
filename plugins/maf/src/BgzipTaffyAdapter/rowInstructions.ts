/**
 * TAF (Taffy Alignment Format) row instruction types
 * Reference: https://github.com/ComparativeGenomicsToolkit/taffy
 *
 * Instruction types:
 * 'i' - insert: add a new sequence row
 * 's' - substitute: replace coordinates of an existing row
 * 'd' - delete: remove a sequence row
 * 'g' - gap: add a fixed-length gap to sequence start
 * 'G' - gap substring: add variable-length gap from substring
 */

import { parseStrand } from '../util/parseStrand.ts'

interface RowInsert {
  type: 'i'
  row: number
  sequenceName: string
  start: number
  strand: number
  sequenceLength: number
}
interface RowSubstitute {
  type: 's'
  row: number
  sequenceName: string
  start: number
  strand: number
  sequenceLength: number
}
interface RowDelete {
  type: 'd'
  row: number
}
interface RowGap {
  type: 'g'
  row: number
  gapLength: number
}
interface RowGapSubstring {
  type: 'G'
  row: number
  gapSubstring: string
}
export type RowInstruction =
  | RowInsert
  | RowDelete
  | RowGap
  | RowGapSubstring
  | RowSubstitute

// Faithfully replicates change_s_coordinates_to_i from taffy/impl/tai.c
// When starting from an indexed position:
// 1. Convert 's' (substitute) to 'i' (insert) - because there's no previous row to substitute
// 2. Remove 'd', 'g', 'G' instructions entirely - they reference non-existent previous state
export function filterFirstLineInstructions(
  instructions: RowInstruction[],
): RowInstruction[] {
  return instructions
    .filter(ins => ins.type === 'i' || ins.type === 's')
    .map(ins => {
      if (ins.type === 's') {
        // Convert 's' to 'i'
        return {
          type: 'i' as const,
          row: ins.row,
          sequenceName: ins.sequenceName,
          start: ins.start,
          strand: ins.strand,
          sequenceLength: ins.sequenceLength,
        }
      }
      return ins
    })
}

/**
 * Parses TAF row instruction string into structured RowInstruction objects
 * Each instruction token sequence is parsed according to TAF format rules
 */
export function parseRowInstructions(meta: string) {
  const ret = meta.split(' ')
  const rows: RowInstruction[] = []

  for (let i = 0; i < ret.length;) {
    const type = ret[i++]
    if (type === 'i' || type === 's') {
      rows.push({
        type,
        row: +ret[i++]!,
        sequenceName: ret[i++]!,
        start: +ret[i++]!,
        strand: parseStrand(ret[i++]),
        sequenceLength: +ret[i++]!,
      })
    } else if (type === 'd') {
      rows.push({
        type,
        row: +ret[i++]!,
      })
    } else if (type === 'g') {
      rows.push({
        type,
        row: +ret[i++]!,
        gapLength: +ret[i++]!,
      })
    } else if (type === 'G') {
      rows.push({
        type,
        row: +ret[i++]!,
        gapSubstring: ret[i++]!,
      })
    } else {
      // Unknown opcode: subsequent tokens may be operands the next iteration
      // would mis-read as opcodes. Surface this instead of silently
      // misaligning the whole instruction stream.
      throw new Error(`Unknown TAF row instruction opcode: ${type}`)
    }
  }
  return rows
}
