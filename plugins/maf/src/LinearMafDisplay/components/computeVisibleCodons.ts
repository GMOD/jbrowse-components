import { codonTable } from '@jbrowse/core/util'

import { eachVisibleRegion, rowBandGeometry } from './visibleRegionGeometry.ts'
import { DASH, LOWER_BIT, SPACE } from '../../util/asciiBytes.ts'

import type { VisibleRegionsView } from './visibleRegionGeometry.ts'
import type {
  MafBlock,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafFrameRecord } from '../../types.ts'

/**
 * How a species' codon compares to the reference (anchor) codon:
 * - `same` — identical codon (no change)
 * - `syn` — synonymous: nucleotides differ but the amino acid is unchanged
 * - `nonsyn` — nonsynonymous: the amino acid changed
 * - `stop` — a stop codon
 */
export type CodonChange = 'same' | 'syn' | 'nonsyn' | 'stop'

export interface CodonMarker {
  /** left px of the codon cell (one piece of the codon) */
  xLeft: number
  /** px width of the codon cell */
  width: number
  /** top px of the row band */
  rowTop: number
  /** band height */
  h: number
  /** center px (amino-acid glyph) */
  x: number
  /** baseline-center y (amino-acid glyph) */
  y: number
  /** single-letter amino acid (`*` = stop) */
  aa: string
  /** how the codon compares to the reference — drives the cell color */
  change: CodonChange
  /**
   * Draw the amino-acid glyph on this cell. A codon stitched across an exon
   * boundary emits one cell per piece (sharing color + residue); only the widest
   * piece sets this so the glyph isn't drawn twice.
   */
  drawGlyph: boolean
}

/**
 * A reference codon as its three reference positions in ascending genomic order
 * plus the reading `strand`. Storing positions explicitly (rather than a single
 * start) lets one code path serve both an ordinary contiguous codon and one
 * stitched across an exon boundary — the only difference is whether the three
 * positions are consecutive. Ascending order means the single reverse-complement
 * in `orientedTriplet` correctly handles `−`-strand codons.
 */
export interface Codon {
  positions: readonly [number, number, number]
  strand: number
}

const COMPLEMENT: Record<string, string> = {
  A: 'T',
  T: 'A',
  G: 'C',
  C: 'G',
  N: 'N',
}

/**
 * The three reference-column bytes of a codon as a single triplet string, read
 * in protein (transcription) orientation — reverse-complemented for a `−`-strand
 * gene so it lines up 5'→3' with the amino acid. Returns undefined when any
 * position is a gap/space (a gap/deletion in that species, so there's no codon).
 * Non-standard bases (`N`) are kept verbatim, so the triplet stays 3 chars for
 * display while `codonTable` still yields no amino acid for it.
 */
export function orientedTriplet(
  b0: number,
  b1: number,
  b2: number,
  strand: number,
): string | undefined {
  if (
    b0 === DASH ||
    b1 === DASH ||
    b2 === DASH ||
    b0 === SPACE ||
    b1 === SPACE ||
    b2 === SPACE
  ) {
    return undefined
  }
  const c0 = String.fromCharCode(b0 & ~LOWER_BIT)
  const c1 = String.fromCharCode(b1 & ~LOWER_BIT)
  const c2 = String.fromCharCode(b2 & ~LOWER_BIT)
  return strand === -1
    ? `${COMPLEMENT[c2] ?? 'N'}${COMPLEMENT[c1] ?? 'N'}${COMPLEMENT[c0] ?? 'N'}`
    : `${c0}${c1}${c2}`
}

/**
 * Translate the three reference-column bytes of a codon to a single-letter amino
 * acid, reverse-complementing for a `−`-strand gene. Returns undefined when any
 * position is a gap/space or the triplet isn't a standard codon (e.g. contains
 * `N`) — the caller then draws no residue there (a gap/deletion in that species).
 */
export function translateCodonBytes(
  b0: number,
  b1: number,
  b2: number,
  strand: number,
): string | undefined {
  const triplet = orientedTriplet(b0, b1, b2, strand)
  return triplet === undefined ? undefined : codonTable[triplet]
}

// The k-th reference position of an exon record in transcription order:
// ascending genomic on `+`, descending on `−` (where `frame` counts from the
// last base). Lets the codon walk below be written once for both strands.
function txPos(f: MafFrameRecord, k: number): number {
  return f.strand === -1 ? f.end - 1 - k : f.start + k
}

// The k-th continuation position in the next exon — starting at `nextFramePos`
// and moving in transcription direction — used to complete a codon that runs off
// this exon's edge into the adjacent one.
function nextExonPos(f: MafFrameRecord, k: number): number {
  return f.strand === -1 ? f.nextFramePos! - k : f.nextFramePos! + k
}

// Build a codon from three transcription-order positions, stored ascending.
function codonOf(p: number[], strand: number): Codon {
  const [a, b, c] = [...p].sort((x, y) => x - y)
  return { positions: [a!, b!, c!], strand }
}

/**
 * The reference codons defined by the anchor species' `mafFrames` records. Each
 * record's `frame` is the codon position (0/1/2) of its first base (`+`) or last
 * base (`−`); the leading `(3 − frame) % 3` bases belong to the previous exon's
 * boundary codon and are emitted there, then full codons proceed in transcription
 * order. A trailing partial codon (the record's length isn't a whole number of
 * codons) is completed from the next exon via `nextFramePos` — UCSC's cross-exon
 * stitch — unless there's no next exon (last CDS exon), where a genuinely partial
 * codon is left untranslated.
 */
export function enumerateCodons(
  frames: MafFrameRecord[],
  src: string,
): Codon[] {
  const codons: Codon[] = []
  for (const f of frames) {
    if (f.src !== src) {
      continue
    }
    const len = f.end - f.start
    const skip = (3 - (f.frame % 3)) % 3
    let i = skip
    for (; i + 3 <= len; i += 3) {
      codons.push(
        codonOf([txPos(f, i), txPos(f, i + 1), txPos(f, i + 2)], f.strand),
      )
    }
    const trail = len - i // 0, 1, or 2 leftover bases at the exon edge
    const hasNextExon = f.nextFramePos !== undefined && f.nextFramePos >= 0
    if (trail > 0 && hasNextExon) {
      const tail = Array.from({ length: trail }, (_, j) => txPos(f, i + j))
      const cont = Array.from({ length: 3 - trail }, (_, j) =>
        nextExonPos(f, j),
      )
      codons.push(codonOf([...tail, ...cont], f.strand))
    }
  }
  return codons
}

/**
 * Reference position → column index within a block: `out[g]` is the column of
 * the g-th non-gap reference byte, so consecutive reference positions map to
 * consecutive entries (insertion columns, where the reference is `-`, are
 * skipped). Lets a codon's three reference bases be read from any row in O(1).
 */
function buildRefColumns(refSeqBytes: Uint8Array): Int32Array {
  let n = 0
  for (const byte of refSeqBytes) {
    if (byte !== DASH) {
      n++
    }
  }
  const out = new Int32Array(n)
  let g = 0
  for (let i = 0; i < refSeqBytes.length; i++) {
    if (refSeqBytes[i] !== DASH) {
      out[g++] = i
    }
  }
  return out
}

interface ComputeVisibleCodonsParams {
  view: VisibleRegionsView
  rpcDataMap: { get(idx: number): MafRegionData | undefined }
  framesDataMap: { get(idx: number): MafFrameRecord[] | undefined }
  /** Anchor species whose frames define the reading frame for every row. */
  defaultSrc: string
  rowHeight: number
  rowProportion: number
}

/** A codon's three reference bytes (from the reference row or a species row),
 * gathered in ascending genomic order — possibly across two blocks. */
type CodonBytes = [number, number, number]

/** A reference position resolved to the block that holds it plus the alignment
 * column of that base within the block. */
interface RefColLoc {
  blockIdx: number
  col: number
}

/**
 * Resolve an absolute reference position to the block containing it and the
 * alignment column of that base within the block. Blocks are disjoint reference
 * ranges (`refColumns.length` reference bases starting at `startBp`), so at most
 * one contains `p`; returns undefined when no fetched block covers it.
 */
function locateRefPos(
  blocks: MafBlock[],
  refColumnsPerBlock: Int32Array[],
  p: number,
): RefColLoc | undefined {
  for (let bi = 0; bi < blocks.length; bi++) {
    const g = p - blocks[bi]!.startBp
    const cols = refColumnsPerBlock[bi]!
    if (g >= 0 && g < cols.length) {
      return { blockIdx: bi, col: cols[g]! }
    }
  }
  return undefined
}

/** Codon type resolved to per-block columns. */
type CodonLocs = [RefColLoc, RefColLoc, RefColLoc]

/**
 * Resolve a codon's three reference positions to per-block columns, or undefined
 * if any position lies outside every fetched block. Unlike a single-block
 * mapping, the three positions may resolve into DIFFERENT blocks — so a codon
 * whose bases straddle a MAF alignment-block boundary (or the two exon pieces of
 * a boundary-stitched codon) is assembled from both blocks rather than dropped.
 */
function locateCodon(
  positions: readonly [number, number, number],
  blocks: MafBlock[],
  refColumnsPerBlock: Int32Array[],
): CodonLocs | undefined {
  const l0 = locateRefPos(blocks, refColumnsPerBlock, positions[0])
  const l1 = locateRefPos(blocks, refColumnsPerBlock, positions[1])
  const l2 = locateRefPos(blocks, refColumnsPerBlock, positions[2])
  return l0 && l1 && l2 ? [l0, l1, l2] : undefined
}

// Per-block rowIndex → alignment bytes, so a codon straddling blocks can read a
// species' bytes from whichever block holds each of its three positions.
function rowByteMap(block: MafBlock): Map<number, Uint8Array> {
  const m = new Map<number, Uint8Array>()
  for (const row of block.rows) {
    m.set(row.rowIndex, row.alignmentBytes)
  }
  return m
}

// The three reference bytes of a located codon (from each position's block).
function refCodonBytes(locs: CodonLocs, blocks: MafBlock[]): CodonBytes {
  return [
    blocks[locs[0].blockIdx]!.refSeqBytes[locs[0].col]!,
    blocks[locs[1].blockIdx]!.refSeqBytes[locs[1].col]!,
    blocks[locs[2].blockIdx]!.refSeqBytes[locs[2].col]!,
  ]
}

/**
 * The three alignment bytes of a located codon for one species row, or undefined
 * if that row is absent from any block the codon spans — a species present in
 * only one of two straddled blocks has no complete codon there, so it's dropped
 * (the same "no residue" outcome as a gapped codon).
 */
function rowCodonBytes(
  locs: CodonLocs,
  rowMapsPerBlock: Map<number, Uint8Array>[],
  rowIndex: number,
): CodonBytes | undefined {
  const r0 = rowMapsPerBlock[locs[0].blockIdx]!.get(rowIndex)
  const r1 = rowMapsPerBlock[locs[1].blockIdx]!.get(rowIndex)
  const r2 = rowMapsPerBlock[locs[2].blockIdx]!.get(rowIndex)
  if (!r0 || !r1 || !r2) {
    return undefined
  }
  const b0 = r0[locs[0].col]
  const b1 = r1[locs[1].col]
  const b2 = r2[locs[2].col]
  return b0 === undefined || b1 === undefined || b2 === undefined
    ? undefined
    : [b0, b1, b2]
}

/**
 * Classify a species' codon against the reference codon — both given as oriented
 * uppercase triplet strings (5'→3' in the gene direction, so `−`-strand codons
 * are already reverse-complemented):
 * - `stop`   — the species codon is a stop
 * - `nonsyn` — its amino acid differs from the reference's (a coding change)
 * - `same`   — the two codons are nucleotide-identical
 * - `syn`    — silent: the nucleotides differ but the amino acid is unchanged
 *
 * Returns undefined when either codon has no amino acid (a non-standard triplet,
 * e.g. one containing `N`): syn vs nonsyn is undefined without both residues, so
 * the codon is left unclassified rather than guessed. Shared by the codon overlay
 * (`computeVisibleCodons`) and the hover lookup (`findCodonAt`) so the colored
 * cell and the tooltip can't disagree.
 */
function classifyChange(
  rowCodon: string,
  refCodon: string,
): { aa: string; change: CodonChange } | undefined {
  const aa = codonTable[rowCodon]
  const refAa = codonTable[refCodon]
  if (aa === undefined || refAa === undefined) {
    return undefined
  }
  const change: CodonChange =
    aa === '*'
      ? 'stop'
      : aa !== refAa
        ? 'nonsyn'
        : rowCodon === refCodon
          ? 'same'
          : 'syn'
  return { aa, change }
}

interface CodonCell {
  xLeft: number
  width: number
  /** center px for the amino-acid glyph */
  x: number
}

// `[startBp, endBpExclusive)` runs of consecutive positions (input ascending).
function consecutiveRuns(positions: readonly number[]): [number, number][] {
  const runs: [number, number][] = []
  for (const p of positions) {
    const last = runs.at(-1)
    if (p === last?.[1]) {
      last[1] = p + 1
    } else {
      runs.push([p, p + 1])
    }
  }
  return runs
}

/**
 * Pixel cells for a codon: one per run of consecutive reference positions. A
 * contiguous codon is a single 3-base cell; a stitched codon is two cells (its
 * two exon pieces). Orientation-aware via `bpToPx`.
 */
function codonCells(
  positions: readonly number[],
  bpToPx: (bp: number) => number,
): CodonCell[] {
  return consecutiveRuns(positions).map(([startBp, endBp]) => {
    const xa = bpToPx(startBp)
    const xb = bpToPx(endBp)
    return {
      xLeft: Math.min(xa, xb),
      width: Math.abs(xb - xa),
      x: bpToPx((startBp + endBp) / 2),
    }
  })
}

// Index of the widest cell — where the single amino-acid glyph is drawn.
function widestCell(cells: CodonCell[]): number {
  let idx = 0
  for (let i = 1; i < cells.length; i++) {
    if (cells[i]!.width > cells[idx]!.width) {
      idx = i
    }
  }
  return idx
}

/**
 * Per-species codon cells for the codon view: each reference codon (from the
 * anchor `mafFrames`) classified in every aligned species against the reference
 * codon — `nonsyn` (amino acid changed), `syn` (silent, nucleotides changed but
 * amino acid unchanged), `stop`, or `same`. Carries the 3-base cell geometry so
 * the overlay can color the codon (replacing the per-base SNP cells) and the
 * center + amino acid so it can draw the residue glyph when the codon is wide
 * enough. Gapped/`N` codons in a species emit no cell (a deletion shows blank).
 * Zoom/mode gating lives in the model (`activeRowRendering === 'codon'`), so this
 * always computes when called.
 */
export function computeVisibleCodons(
  params: ComputeVisibleCodonsParams,
): CodonMarker[] {
  const {
    view,
    rpcDataMap,
    framesDataMap,
    defaultSrc,
    rowHeight,
    rowProportion,
  } = params
  const markers: CodonMarker[] = []
  const { h, offset } = rowBandGeometry(rowHeight, rowProportion)
  const hp2 = h / 2

  for (const {
    data: regionData,
    bpToPx,
    displayedRegionIndex,
  } of eachVisibleRegion(view, rpcDataMap)) {
    const frames = framesDataMap.get(displayedRegionIndex)
    if (!frames) {
      continue
    }
    const codons = enumerateCodons(frames, defaultSrc)
    if (codons.length === 0) {
      continue
    }

    const blocks = regionData.blocks
    const refColumnsPerBlock = blocks.map(bl => buildRefColumns(bl.refSeqBytes))
    const rowMapsPerBlock = blocks.map(rowByteMap)

    for (const codon of codons) {
      const locs = locateCodon(codon.positions, blocks, refColumnsPerBlock)
      if (!locs) {
        continue
      }
      const refBytes = refCodonBytes(locs, blocks)
      const refCodon = orientedTriplet(
        refBytes[0],
        refBytes[1],
        refBytes[2],
        codon.strand,
      )
      // A reference codon with a gap/`N` has no amino acid to compare against,
      // so no species codon can be classified here (mirrors the conservation
      // band, which skips the same codon) — draw nothing rather than guess.
      if (refCodon === undefined || codonTable[refCodon] === undefined) {
        continue
      }
      const cells = codonCells(codon.positions, bpToPx)
      const glyphIdx = widestCell(cells)
      // A species must appear in every block the codon spans to have a complete
      // codon; iterate the rows of the block holding its first (lowest) base and
      // pull the other bases from their blocks (all the same block in the common
      // single-block case). Row order is preserved for a stable marker order.
      for (const row of blocks[locs[0].blockIdx]!.rows) {
        const rowBytes = rowCodonBytes(locs, rowMapsPerBlock, row.rowIndex)
        if (!rowBytes) {
          continue
        }
        const rowCodon = orientedTriplet(
          rowBytes[0],
          rowBytes[1],
          rowBytes[2],
          codon.strand,
        )
        if (rowCodon === undefined) {
          continue
        }
        const cls = classifyChange(rowCodon, refCodon)
        if (!cls) {
          continue
        }
        const rowTop = offset + rowHeight * row.rowIndex
        const y = Math.round(hp2 + rowTop)
        cells.forEach((cell, i) => {
          markers.push({
            xLeft: cell.xLeft,
            width: cell.width,
            rowTop,
            h,
            x: cell.x,
            y,
            aa: cls.aa,
            change: cls.change,
            drawGlyph: i === glyphIdx,
          })
        })
      }
    }
  }
  return markers
}

/**
 * One reference codon's protein-level conservation, as a pixel cell plus the
 * fraction of aligned species whose amino acid matches the reference. A codon
 * stitched across an exon boundary yields one bar per piece (sharing `fraction`).
 */
export interface CodonConservationBar {
  /** left px of the codon cell (one piece of the codon) */
  xLeft: number
  /** px width of the codon cell */
  width: number
  /**
   * Fraction (0..1) of aligned non-reference species whose translated amino
   * acid matches the reference amino acid at this codon — protein-level
   * conservation, where synonymous (silent) substitutions still read as
   * conserved. `NaN` when no species has a translatable codon here (all gapped
   * / non-standard), so the bar is skipped like a `NaN` per-base identity.
   */
  fraction: number
}

interface ComputeCodonConservationParams {
  view: VisibleRegionsView
  rpcDataMap: { get(idx: number): MafRegionData | undefined }
  framesDataMap: { get(idx: number): MafFrameRecord[] | undefined }
  /** Anchor species whose frames define the reading frame (the reference). */
  defaultSrc: string
  /**
   * Display row of the reference species, excluded from the numerator and
   * denominator so its trivial self-match doesn't inflate conservation (same
   * policy as the per-base `computeMafCoverage`). `-1` counts all rows.
   */
  refRowIndex: number
}

/**
 * Per-codon protein-level conservation for the conservation band's codon mode:
 * each reference codon (from the anchor `mafFrames`) carries the fraction of
 * aligned non-reference species whose translated amino acid equals the reference
 * amino acid — the codon-resolution analog of the per-base percent identity
 * `computeMafCoverage` ships. Synonymous substitutions count as conserved (the
 * amino acid is unchanged), so this reads selection on the protein rather than
 * nucleotide drift, and 3rd-codon-position wobble stops dragging the profile
 * down. Only defined inside the CDS; a reference codon with a gap/`N` (no
 * reference amino acid) emits no bar. Reuses the same codon enumeration + column
 * mapping as the codon overlay so the band and the per-species cells can't
 * disagree about the reading frame.
 */
export function computeCodonConservation(
  params: ComputeCodonConservationParams,
): CodonConservationBar[] {
  const { view, rpcDataMap, framesDataMap, defaultSrc, refRowIndex } = params
  const bars: CodonConservationBar[] = []
  for (const {
    data: regionData,
    bpToPx,
    displayedRegionIndex,
  } of eachVisibleRegion(view, rpcDataMap)) {
    const frames = framesDataMap.get(displayedRegionIndex)
    if (!frames) {
      continue
    }
    const codons = enumerateCodons(frames, defaultSrc)
    if (codons.length === 0) {
      continue
    }
    const blocks = regionData.blocks
    const refColumnsPerBlock = blocks.map(bl => buildRefColumns(bl.refSeqBytes))
    const rowMapsPerBlock = blocks.map(rowByteMap)
    for (const codon of codons) {
      const locs = locateCodon(codon.positions, blocks, refColumnsPerBlock)
      if (!locs) {
        continue
      }
      const refBytes = refCodonBytes(locs, blocks)
      const refAa = translateCodonBytes(
        refBytes[0],
        refBytes[1],
        refBytes[2],
        codon.strand,
      )
      if (refAa === undefined) {
        continue
      }
      let matches = 0
      let classifiable = 0
      for (const row of blocks[locs[0].blockIdx]!.rows) {
        if (row.rowIndex !== refRowIndex) {
          const rowBytes = rowCodonBytes(locs, rowMapsPerBlock, row.rowIndex)
          const aa =
            rowBytes &&
            translateCodonBytes(
              rowBytes[0],
              rowBytes[1],
              rowBytes[2],
              codon.strand,
            )
          if (aa) {
            classifiable += 1
            if (aa === refAa) {
              matches += 1
            }
          }
        }
      }
      const fraction = classifiable > 0 ? matches / classifiable : Number.NaN
      for (const cell of codonCells(codon.positions, bpToPx)) {
        bars.push({ xLeft: cell.xLeft, width: cell.width, fraction })
      }
    }
  }
  return bars
}

/** A single species' codon resolved under the cursor, for the hover tooltip. */
export interface CodonHit {
  /** the species' codon triplet, read 5'→3' in the gene direction */
  codon: string
  /** the species' amino acid (`*` = stop) */
  aa: string
  /** the reference codon triplet at the same positions */
  refCodon: string | undefined
  /** the reference amino acid */
  refAa: string | undefined
  /** how the species' codon compares to the reference */
  change: CodonChange
}

interface FindCodonAtParams {
  blocks: MafBlock[]
  frames: MafFrameRecord[]
  /** Anchor species whose frames define the reading frame (the reference). */
  defaultSrc: string
  /** absolute genomic reference position under the cursor (uint32) */
  bp: number
  /** display row of the species being hovered */
  rowIndex: number
}

/**
 * Resolve the codon under the cursor on one species' row, for the codon-view
 * tooltip: the species' codon nucleotides + amino acid, the reference codon +
 * amino acid, and the syn/nonsyn/stop classification — the same data the colored
 * cell encodes, read for a single (bp, row). Returns undefined when no codon
 * covers `bp` (outside the CDS, or the boundary codon dropped at an exon join),
 * the codon's three reference bases don't all lie in one fetched block, the row
 * is absent, or the species' codon is gapped/non-standard there.
 */
export function findCodonAt(params: FindCodonAtParams): CodonHit | undefined {
  const { blocks, frames, defaultSrc, bp, rowIndex } = params
  const codon = enumerateCodons(frames, defaultSrc).find(c =>
    c.positions.includes(bp),
  )
  if (!codon) {
    return undefined
  }
  const refColumnsPerBlock = blocks.map(bl => buildRefColumns(bl.refSeqBytes))
  const rowMapsPerBlock = blocks.map(rowByteMap)
  const locs = locateCodon(codon.positions, blocks, refColumnsPerBlock)
  if (!locs) {
    return undefined
  }
  const refBytes = refCodonBytes(locs, blocks)
  const rowBytes = rowCodonBytes(locs, rowMapsPerBlock, rowIndex)
  if (!rowBytes) {
    return undefined
  }
  const refCodon = orientedTriplet(
    refBytes[0],
    refBytes[1],
    refBytes[2],
    codon.strand,
  )
  const rowCodon = orientedTriplet(
    rowBytes[0],
    rowBytes[1],
    rowBytes[2],
    codon.strand,
  )
  if (refCodon === undefined || rowCodon === undefined) {
    return undefined
  }
  const cls = classifyChange(rowCodon, refCodon)
  return cls
    ? {
        codon: rowCodon,
        aa: cls.aa,
        refCodon,
        refAa: codonTable[refCodon],
        change: cls.change,
      }
    : undefined
}
