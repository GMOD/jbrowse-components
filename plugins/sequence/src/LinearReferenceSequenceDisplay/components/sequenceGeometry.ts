import { getContrastRatio, getContrastText } from '@jbrowse/core/ui/palette'
import { defaultStarts, revcom } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import type { SequenceMarkState } from './sequenceMarks.ts'
import type { ColorQuad, JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { Frame } from '@jbrowse/core/util'

/** One painted cell's fill, packed for the marks, and the letter color on it. */
export interface SeqColor {
  fill: string
  abgr: number
  text: string
}

export function seqColor(fill: string, text: string): SeqColor {
  return { fill, abgr: cssColorToABGR(fill), text }
}

export interface ColorPalette {
  bases: Map<string, SeqColor>
  frames: Map<Frame, SeqColor>
  start: SeqColor
  stop: SeqColor
  fallback: SeqColor
}

// Anything with no palette entry of its own: IUPAC ambiguity codes, and every
// residue of a peptide track.
const FALLBACK_FILL = '#aaaaaa'

function fromQuad({ main, contrastText }: ColorQuad): SeqColor {
  return seqColor(main, contrastText)
}

function fromString(fill: string): SeqColor {
  return seqColor(fill, getContrastText(fill))
}

// The translation rows are mid greys, where the palette's 3:1 rule picks white
// though black reads twice as well, so these take whichever reads better.
function fromFrameQuad({ main }: ColorQuad): SeqColor {
  const light = '#fff'
  return seqColor(
    main,
    getContrastRatio(main, '#000') >= getContrastRatio(main, light)
      ? 'rgba(0, 0, 0, 0.87)'
      : light,
  )
}

export function buildColorPalette(
  palette: JBrowsePalette,
  colorByCDS: boolean,
): ColorPalette {
  // [null, f1, f2, f3, f-3, f-2, f-1], so `.at(frame)` reads either sign
  const framePalette = colorByCDS ? palette.framesCDS : palette.frames
  return {
    bases: new Map(
      Object.entries(palette.bases).map(([base, quad]) => [
        base,
        fromQuad(quad),
      ]),
    ),
    frames: new Map(
      ([1, 2, 3, -1, -2, -3] as Frame[]).map(frame => [
        frame,
        fromFrameQuad(framePalette.at(frame)!),
      ]),
    ),
    start: fromString(palette.startCodon),
    stop: fromString(palette.stopCodon),
    fallback: fromString(FALLBACK_FILL),
  }
}

export type SequenceRow =
  | { type: 'base'; strand: 1 | -1 }
  | { type: 'translation'; frame: Frame }

export interface RowVisibility {
  showForward: boolean
  showReverse: boolean
  showTranslation: boolean
}

/** What the cells' encode reads beyond the sequence itself. */
export interface CellEncoding extends RowVisibility {
  isDna: boolean
  palette: ColorPalette
}

/** Everything the marks and the letters need to paint a frame. */
export interface SequenceRenderState extends CellEncoding, SequenceMarkState {}

/**
 * Top-to-bottom row order for a block, which the encode, the letters, the
 * hover and the row count all walk.
 */
export function rowLayout(
  { showForward, showReverse, showTranslation }: RowVisibility,
  reversed: boolean,
): SequenceRow[] {
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
    ...bottomFrames.map((frame): SequenceRow => ({
      type: 'translation',
      frame,
    })),
  ]
}

/**
 * Whether a base row shows the complement of the forward sequence: the forward
 * row does when the block is flipped, the reverse row does when it isn't. A
 * peptide's residues have no complement.
 */
export function baseRowComplemented(
  strand: 1 | -1,
  reversed: boolean,
  isDna: boolean,
) {
  return isDna && (strand === 1 ? reversed : !reversed)
}

/** Orientation only reorders the stack, so the forward count holds for both. */
export function rowCount(visibility: RowVisibility) {
  return rowLayout(visibility, false).length
}

/** Whether a base is wide enough, in px, to carry a border and a letter. */
export function showsLetters(bpPerPx: number) {
  return 1 / bpPerPx >= 12
}

const startsSet = new Set(defaultStarts)

export type CodonKind = 'start' | 'stop' | 'normal'

// Stops come from the active genetic code (a codon mapping to '*'), so e.g. the
// mitochondrial code marks AGA/AGG as stops and TGA as Trp. Start highlighting
// stays ATG-only: alternative initiators (GTG/TTG) only act as starts at a true
// CDS 5' end, so flagging every occurrence in a raw 3-frame translation would be
// misleading noise.
export function codonKind(
  upperCodon: string,
  codonTable: Record<string, string>,
): CodonKind {
  return startsSet.has(upperCodon)
    ? 'start'
    : codonTable[upperCodon] === '*'
      ? 'stop'
      : 'normal'
}

export interface Codon {
  codon: string
  aminoAcid: string
  kind: CodonKind
}

/**
 * The codon at index `i` of `seq`, read on `frame`'s strand: a negative frame's
 * triplet is the reverse complement of the forward one whatever the block's
 * orientation. A triplet the table has no entry for, such as one holding an N,
 * translates to X.
 */
export function readCodon(
  seq: string,
  i: number,
  frame: Frame,
  codonTable: Record<string, string>,
): Codon {
  const raw = seq.slice(i, i + 3)
  const codon = frame < 0 ? revcom(raw) : raw
  return {
    codon,
    aminoAcid: codonTable[codon] ?? 'X',
    kind: codonKind(codon.toUpperCase(), codonTable),
  }
}

/**
 * How far absolute `coord` sits past the last codon boundary of `frame`'s grid,
 * which is anchored where `coord % 3 === abs(frame) - 1`.
 */
export function codonPhase(coord: number, frame: Frame) {
  return (((coord - (Math.abs(frame) - 1)) % 3) + 3) % 3
}

/**
 * `frameShift` is the index of the first codon boundary in `seq`; `sliceEnd` is
 * the index just past the last complete codon.
 */
export function frameShiftBounds(seq: string, seqStart: number, frame: Frame) {
  const frameShift = (3 - codonPhase(seqStart, frame)) % 3
  const adjLen = seq.length - frameShift
  const sliceEnd = frameShift + adjLen - (adjLen % 3)
  return { frameShift, sliceEnd }
}

/**
 * Half-open `[start, end)` index range into a sequence that overlaps a block.
 * `Math.floor`/`Math.ceil` cover fractional bpPerPx where block edges land on
 * non-integer genomic positions.
 */
export function visibleRange(
  blockStart: number,
  blockEnd: number,
  seqStart: number,
  seqLen: number,
) {
  return {
    start: Math.max(0, Math.floor(blockStart - seqStart)),
    end: Math.min(seqLen, Math.ceil(blockEnd - seqStart)),
  }
}

/**
 * Codon-aligned half-open `[start, end)` index range to paint for one frame:
 * the visible range widened by one codon of slop (so a codon straddling either
 * edge still renders), snapped back to the `frameShift` codon grid, and clamped
 * to the last complete codon (`sliceEnd`).
 */
export function visibleCodonRange(
  blockStart: number,
  blockEnd: number,
  seqStart: number,
  seqLen: number,
  frameShift: number,
  sliceEnd: number,
) {
  const { start, end } = visibleRange(blockStart, blockEnd, seqStart, seqLen)
  const from = Math.max(frameShift, start - 3)
  return {
    start: from - ((from - frameShift) % 3),
    end: Math.min(sliceEnd, end + 3),
  }
}
