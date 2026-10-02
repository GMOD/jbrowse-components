import { complement, revcom } from '@jbrowse/core/util'

import {
  baseRowComplemented,
  codonKind,
  codonPhase,
} from './sequenceGeometry.ts'

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

/**
 * What the display painted at genomic `coord0` in a given row. `reversed` is the
 * block's display orientation; a base reports the strand its letter belongs to,
 * which on a flipped block is not the row's own.
 */
export function hoverDetailForRow(
  row: SequenceRow,
  seq: string,
  seqStart: number,
  coord0: number,
  reversed: boolean,
  isDna: boolean,
  codonTable: Record<string, string>,
): HoverDetail | undefined {
  const fwdBase = seq[coord0 - seqStart]?.toUpperCase()
  if (row.type === 'base') {
    const complemented = baseRowComplemented(row.strand, reversed, isDna)
    return fwdBase
      ? {
          type: 'base',
          strand: complemented ? -1 : 1,
          base: complemented ? complement(fwdBase) : fwdBase,
        }
      : undefined
  }
  const start = coord0 - codonPhase(coord0, row.frame)
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
