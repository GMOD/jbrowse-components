import { complementTable, revcom } from '@jbrowse/core/util'
import { getGeneticCode } from '@jbrowse/core/util/geneticCodes'

import {
  baseRowComplemented,
  codonKind,
  frameShiftBounds,
  rowLayout,
} from './sequenceGeometry.ts'

import type { SequenceRegionData } from '../model.ts'
import type {
  CellEncoding,
  ColorPalette,
  SeqColor,
} from './sequenceGeometry.ts'
import type { Frame } from '@jbrowse/core/util'

/**
 * One row's worth of cells per base or codon, as the `sequenceCell` shape
 * reads them: `[x, x2)` in absolute bp, the stack slot, the packed fill, and
 * whether the cell takes a border and a letter once zoomed in. A partial codon
 * at a region edge is a cell with no border.
 */
export interface SequenceCellChannels {
  x: Uint32Array
  x2: Uint32Array
  row: Uint32Array
  color: Uint32Array
  bordered: Uint32Array
  count: number
}

export interface SequenceCells {
  bases: SequenceCellChannels
  codons: SequenceCellChannels
}

/**
 * The letter and colour of the base at `fwd` in a base row. A peptide track's
 * residues are not nucleotides (its A/C/G/T are Ala, Cys, Gly and Thr), so only
 * DNA consults the base palette.
 */
export function baseCell(
  fwd: string,
  complemented: boolean,
  isDna: boolean,
  palette: ColorPalette,
) {
  const letter = complemented ? (complementTable[fwd] ?? fwd) : fwd
  const color =
    (isDna ? palette.bases.get(letter.toUpperCase()) : undefined) ??
    palette.fallback
  return { letter, color }
}

/**
 * The amino acid and colour of the codon starting at `i`. A negative frame
 * reads the other strand, so its triplet is the reverse complement of the
 * forward one whatever the block's orientation.
 */
export function codonCell(
  seq: string,
  i: number,
  frame: Frame,
  codonTable: Record<string, string>,
  palette: ColorPalette,
) {
  const raw = seq.slice(i, i + 3)
  const codon = frame < 0 ? revcom(raw) : raw
  const kind = codonKind(codon.toUpperCase(), codonTable)
  const color: SeqColor =
    kind === 'start'
      ? palette.start
      : kind === 'stop'
        ? palette.stop
        : frameColor(frame, palette)
  return { aminoAcid: codonTable[codon] ?? '', color }
}

export function frameColor(frame: Frame, palette: ColorPalette) {
  return palette.frames.get(frame) ?? palette.fallback
}

function cellChannels(capacity: number): SequenceCellChannels {
  return {
    x: new Uint32Array(capacity),
    x2: new Uint32Array(capacity),
    row: new Uint32Array(capacity),
    color: new Uint32Array(capacity),
    bordered: new Uint32Array(capacity),
    count: 0,
  }
}

function pushCell(
  c: SequenceCellChannels,
  x: number,
  x2: number,
  row: number,
  color: number,
  bordered: boolean,
) {
  const i = c.count++
  c.x[i] = x
  c.x2[i] = x2
  c.row[i] = row
  c.color[i] = color
  c.bordered[i] = bordered ? 1 : 0
}

function trimmed(c: SequenceCellChannels): SequenceCellChannels {
  const { count } = c
  return {
    x: c.x.subarray(0, count),
    x2: c.x2.subarray(0, count),
    row: c.row.subarray(0, count),
    color: c.color.subarray(0, count),
    bordered: c.bordered.subarray(0, count),
    count,
  }
}

/**
 * Every cell of one region's stack, in the row order `rowLayout` gives the
 * region's orientation. `reversed` swaps the stack and which base row carries
 * the complement, so a flipped region encodes differently.
 */
export function encodeSequenceCells(
  data: SequenceRegionData,
  { isDna, palette, ...visibility }: CellEncoding,
  reversed: boolean,
): SequenceCells {
  const { seq, start } = data
  const len = seq.length
  const layout = rowLayout(visibility, reversed)
  const baseRows = layout.filter(r => r.type === 'base').length
  const bases = cellChannels(len * baseRows)
  const codons = cellChannels(
    (Math.floor(len / 3) + 2) * (layout.length - baseRows),
  )
  const codonTable = getGeneticCode(data.geneticCodeId).codonTable

  for (const [slot, row] of layout.entries()) {
    if (row.type === 'base') {
      const complemented = baseRowComplemented(row.strand, reversed, isDna)
      for (let i = 0; i < len; i++) {
        const { color } = baseCell(seq[i]!, complemented, isDna, palette)
        pushCell(bases, start + i, start + i + 1, slot, color.abgr, true)
      }
    } else {
      const { frame } = row
      const bg = frameColor(frame, palette).abgr
      const { frameShift, sliceEnd } = frameShiftBounds(seq, start, frame)
      const lead = Math.min(frameShift, len)
      if (lead > 0) {
        pushCell(codons, start, start + lead, slot, bg, false)
      }
      for (let i = frameShift; i < sliceEnd; i += 3) {
        const { color } = codonCell(seq, i, frame, codonTable, palette)
        pushCell(codons, start + i, start + i + 3, slot, color.abgr, true)
      }
      if (sliceEnd < len) {
        pushCell(codons, start + sliceEnd, start + len, slot, bg, false)
      }
    }
  }
  return { bases: trimmed(bases), codons: trimmed(codons) }
}
