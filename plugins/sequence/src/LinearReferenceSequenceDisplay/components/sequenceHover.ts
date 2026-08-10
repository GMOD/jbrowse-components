import { complement, revcom } from '@jbrowse/core/util'

import { baseRowComplemented, codonKind } from './sequenceGeometry.ts'

import type { CodonKind, SequenceRow } from './sequenceGeometry.ts'
import type { Frame } from '@jbrowse/core/util'

export type HoverDetail =
  // `strand` is the strand the reported `base` belongs to, which is not always
  // the strand of the row it was read from — see hoverDetailForRow.
  | { type: 'base'; strand: 1 | -1; base: string }
  | {
      type: 'codon'
      frame: Frame
      codon: string
      aminoAcid: string
      kind: CodonKind
    }

export interface SequenceHover {
  refName: string
  // 1-based genomic position for display
  coord: number
  // absent when the cursor is between rows (e.g. off the bottom of the stack)
  detail?: HoverDetail
}

// Largest codon-grid boundary <= coord0 for a frame. Codons for frame f are
// anchored to absolute coordinates where coord % 3 === abs(f) - 1, matching
// frameShiftBounds so the hovered codon lines up with the painted grid.
function codonStart(coord0: number, frame: Frame) {
  const normalizedFrame = Math.abs(frame) - 1
  return coord0 - ((((coord0 - normalizedFrame) % 3) + 3) % 3)
}

/**
 * What the display painted at genomic `coord0` in a given row. `reversed` is the
 * block's display orientation; base rows show the same complemented letter
 * drawSequenceBlocks draws when flipped, and translation rows revcom the forward
 * codon for negative frames.
 */
export function hoverDetailForRow(
  row: SequenceRow,
  seq: string,
  seqStart: number,
  coord0: number,
  reversed: boolean,
  codonTable: Record<string, string>,
): HoverDetail | undefined {
  const fwdBase = seq[coord0 - seqStart]?.toUpperCase()
  if (row.type === 'base') {
    // Flipping the view swaps which row carries the complement (the top row
    // keeps reading 5'->3' left to right), so the letter shown in the row the
    // user ticked as "forward" is the *minus*-strand base there. Report the
    // strand the letter actually belongs to rather than echoing `row.strand`,
    // which labelled a complemented base "+ strand: T" at a coordinate whose
    // plus strand is A. One term decides both, so they cannot disagree.
    const complemented = baseRowComplemented(row.strand, reversed)
    return fwdBase
      ? {
          type: 'base',
          strand: complemented ? -1 : 1,
          base: complemented ? complement(fwdBase) : fwdBase,
        }
      : undefined
  }
  const start = codonStart(coord0, row.frame)
  const raw = seq.slice(start - seqStart, start - seqStart + 3)
  const codon = (row.frame > 0 ? raw : revcom(raw)).toUpperCase()
  const aminoAcid = codon.length === 3 ? codonTable[codon] : undefined
  return aminoAcid
    ? {
        type: 'codon',
        frame: row.frame,
        codon,
        aminoAcid,
        kind: codonKind(codon, codonTable),
      }
    : undefined
}
