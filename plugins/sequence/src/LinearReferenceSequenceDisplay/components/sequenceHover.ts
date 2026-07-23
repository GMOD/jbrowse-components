import { complement, revcom } from '@jbrowse/core/util'

import { codonKind } from './sequenceGeometry.ts'

import type { CodonKind } from './sequenceGeometry.ts'
import type { Frame } from '@jbrowse/core/util'

// A single stacked row as painted by drawSequenceBlocks, top-to-bottom. `base`
// rows carry a conceptual strand (+ forward, - reverse); `translation` rows
// carry their reading frame.
export type SequenceRow =
  | { type: 'base'; strand: 1 | -1 }
  | { type: 'translation'; frame: Frame }

/**
 * Top-to-bottom row order for a block, mirroring the frame layout and
 * `reversed` handling in drawSequenceBlocks so a mouse-y maps to the same row
 * the user sees.
 */
export function rowLayout({
  showForward,
  showReverse,
  showTranslation,
  reversed,
}: {
  showForward: boolean
  showReverse: boolean
  showTranslation: boolean
  reversed: boolean
}): SequenceRow[] {
  const forwardFrames: Frame[] = showTranslation && showForward ? [3, 2, 1] : []
  const reverseFrames: Frame[] =
    showTranslation && showReverse ? [-1, -2, -3] : []
  const [topFrames, bottomFrames] = reversed
    ? [reverseFrames.toReversed(), forwardFrames.toReversed()]
    : [forwardFrames, reverseFrames]

  return [
    ...topFrames.map((frame): SequenceRow => ({ type: 'translation', frame })),
    ...(showForward ? [{ type: 'base', strand: 1 } as const] : []),
    ...(showReverse ? [{ type: 'base', strand: -1 } as const] : []),
    ...bottomFrames.map(
      (frame): SequenceRow => ({
        type: 'translation',
        frame,
      }),
    ),
  ]
}

export type HoverDetail =
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
    // forward row shows the complement when flipped, reverse row shows it when
    // not flipped — the two swap under reversal (see drawSequenceBlocks)
    const complemented = row.strand === 1 ? reversed : !reversed
    return fwdBase
      ? {
          type: 'base',
          strand: row.strand,
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
