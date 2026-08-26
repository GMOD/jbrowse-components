import { codonTable } from '@jbrowse/core/util'

import { buildColumnForGenomicOffset } from '../../LinearMafRenderer/binning.ts'
import { blockIndexAtBp } from '../../LinearMafRenderer/blockAtBp.ts'
import { LOWER_BIT, isNoBaseByte } from '../../util/asciiBytes.ts'
import {
  bpSpanPx,
  eachVisibleRegion,
  rowBandGeometry,
  visibleRowRange,
} from './visibleRegionGeometry.ts'

import type { GenomicColumns } from '../../LinearMafRenderer/binning.ts'
import type {
  MafBlock,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafFrameRecord } from '../../types.ts'
import type {
  BpToPx,
  MafRowGeometryParams,
  VisibleRegionsView,
} from './visibleRegionGeometry.ts'

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
function orientedTriplet(
  b0: number,
  b1: number,
  b2: number,
  strand: number,
): string | undefined {
  if (isNoBaseByte(b0) || isNoBaseByte(b1) || isNoBaseByte(b2)) {
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
 * How many bases at the *start* of an exon (in transcription order) belong to
 * the previous exon's boundary codon, from this record's `frame`.
 *
 * `frame` is the codon position of the record's first base, so frame 0 starts a
 * codon and skips nothing, frame 1 means one base of the previous codon is
 * still to come and two of this exon's are needed, frame 2 means two are still
 * to come and one is needed. That is `(3 - frame) % 3`, and the shape of it is
 * why it gets a name: read inline it is easy to take for `frame` itself, and
 * off by one either way it silently shifts every codon in the exon by a base —
 * which reads as the alignment being wrong, not the arithmetic.
 *
 * The double modulo tolerates a junk `frame` from a malformed file rather than
 * producing a negative skip that would index off the front of the record.
 */
function leadingPartialBases(frame: number): number {
  return (3 - (((frame % 3) + 3) % 3)) % 3
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
    let i = leadingPartialBases(f.frame)
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
 * The two per-block indexes a codon lookup needs — reference position → column
 * (the shared `buildColumnForGenomicOffset`, so the codon walk and the two base
 * painters agree on what a block's genomic offsets map to) and rowIndex →
 * alignment bytes — each built on first use.
 *
 * Lazy because a codon touches a handful of blocks and a region holds far more:
 * the data is the *buffered* region, tens of thousands of blocks on a
 * fine-grained multiz, and building a typed array and a `Map` for every one of
 * them was the walk's dominant cost. Codon cells only draw at base level, where
 * that gap is small — but the codon conservation band consumes the same spine
 * with no zoom gate at all, so it ran the whole-region build on every frame at
 * every zoom.
 */
class BlockIndexes {
  private refColumns: (GenomicColumns | undefined)[]

  private rowBytes: (Map<number, Uint8Array> | undefined)[]

  constructor(private blocks: MafBlock[]) {
    this.refColumns = new Array<GenomicColumns | undefined>(blocks.length)
    this.rowBytes = new Array<Map<number, Uint8Array> | undefined>(
      blocks.length,
    )
  }

  columnsAt(blockIdx: number): GenomicColumns {
    return (this.refColumns[blockIdx] ??= buildColumnForGenomicOffset(
      this.blocks[blockIdx]!.refSeqBytes,
    ))
  }

  // So a codon straddling blocks can read a species' bytes from whichever block
  // holds each of its three positions.
  rowBytesAt(blockIdx: number): Map<number, Uint8Array> {
    return (this.rowBytes[blockIdx] ??= new Map(
      this.blocks[blockIdx]!.rows.map(row => [
        row.rowIndex,
        row.alignmentBytes,
      ]),
    ))
  }
}

/**
 * Resolve an absolute reference position to the block containing it and the
 * alignment column of that base within the block. Blocks are disjoint reference
 * ranges (`refLen` reference bases starting at `startBp`, which is what `endBp`
 * records), so at most one contains `p` and `blockIndexAtBp` binary-searches it;
 * returns undefined when no fetched block covers it. The scan this replaced ran
 * three times per codon over the whole buffered region, so it was quadratic in
 * the block count on a fine-grained multiz.
 */
function locateRefPos(
  blocks: MafBlock[],
  indexes: BlockIndexes,
  p: number,
): RefColLoc | undefined {
  const bi = blockIndexAtBp(blocks, p)
  if (bi === -1) {
    return undefined
  }
  const g = p - blocks[bi]!.startBp
  const { colForGpos, refLen } = indexes.columnsAt(bi)
  return g < refLen ? { blockIdx: bi, col: colForGpos[g]! } : undefined
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
  indexes: BlockIndexes,
): CodonLocs | undefined {
  const l0 = locateRefPos(blocks, indexes, positions[0])
  const l1 = locateRefPos(blocks, indexes, positions[1])
  const l2 = locateRefPos(blocks, indexes, positions[2])
  return l0 && l1 && l2 ? [l0, l1, l2] : undefined
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
  indexes: BlockIndexes,
  rowIndex: number,
): CodonBytes | undefined {
  const r0 = indexes.rowBytesAt(locs[0].blockIdx).get(rowIndex)
  const r1 = indexes.rowBytesAt(locs[1].blockIdx).get(rowIndex)
  const r2 = indexes.rowBytesAt(locs[2].blockIdx).get(rowIndex)
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

/** The per-region inputs the codon spine walks. */
export interface LocateVisibleCodonsParams {
  view: VisibleRegionsView
  rpcDataMap: { get(idx: number): MafRegionData | undefined }
  framesDataMap: { get(idx: number): MafFrameRecord[] | undefined }
  /** Anchor species whose frames define the reading frame for every row. */
  defaultSrc: string
}

/** One reference codon resolved against the fetched blocks of its region. */
export interface LocatedCodon {
  /**
   * The region this codon was resolved in. Carried because absolute genomic bp
   * is only unique *within* a displayed region — two regions on different
   * chromosomes can both cover the same coordinate — so the hover lookup has to
   * scope its search by region rather than by bp alone.
   */
  displayedRegionIndex: number
  /** the codon's three reference positions (ascending) + reading strand */
  codon: Codon
  /** its three reference bytes, in the same ascending order */
  refBytes: CodonBytes
  /** absolute genomic bp → screen px, for this codon's region */
  bpToPx: BpToPx
  /**
   * The codon's pixel cells — one per run of consecutive reference positions,
   * so a contiguous codon is one cell and an exon-boundary-stitched one is two.
   *
   * Memoized per codon rather than computed by each consumer, because there are
   * two of them and they are both on at once whenever the conservation band is
   * in codon mode under the codon view: `computeVisibleCodons` and
   * `computeCodonConservation` each used to call `codonCells`, so every codon
   * on screen ran the run-split and its two `bpToPx` calls twice per frame.
   *
   * Safe to cache on the object because `bpToPx` is captured from the region
   * this codon was resolved in, and the whole `locatedCodons` array is rebuilt
   * (the model's computed re-evaluates) whenever the view moves — the same
   * thing that makes the array worth memoizing at all.
   */
  cells: () => CodonCell[]
  /**
   * The species rows carrying a complete codon here, each with its three
   * alignment bytes in ascending order. A row absent from any block the codon
   * spans has no complete codon and is skipped, as is a row whose bytes can't
   * be read. Iterated in block row order, so marker order stays stable.
   */
  rows: () => Generator<{ rowIndex: number; bytes: CodonBytes }>
}

/**
 * Walk every reference codon (from the anchor species' `mafFrames`) that the
 * fetched blocks can resolve, across the visible regions — the shared spine of
 * the codon overlay (`computeVisibleCodons`) and the codon conservation band
 * (`computeCodonConservation`). Both need the identical setup: enumerate the
 * anchor's codons, index each block's reference columns, then resolve each
 * codon's three positions to per-block columns and gather the reference + per-row
 * bytes. Only what they do with those bytes differs — colored cells vs. a match
 * fraction — so keeping the resolution here means the band and the cells can't
 * drift on reading frame, block straddling, or which rows count.
 */
function* eachLocatedCodon(
  params: LocateVisibleCodonsParams,
): Generator<LocatedCodon> {
  const { view, rpcDataMap, framesDataMap, defaultSrc } = params
  for (const {
    data: regionData,
    bpToPx,
    displayedRegionIndex,
    bpLo,
    bpHi,
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
    const indexes = new BlockIndexes(blocks)
    for (const codon of codons) {
      // Both the frames and the alignment are fetched for the *buffered*
      // region, so about half of what `enumerateCodons` yields is off screen —
      // and resolving one is three binary searches plus a per-row byte gather,
      // the most expensive per-item work of any of these walks. This is the
      // `bpLo`/`bpHi` cull every sibling overlay already applies
      // (`computeVisibleInsertions` and friends); the codon spine got
      // `blockIndexAtBp` in the same pass and was the one walk left without it.
      // Positions are ascending, so the codon spans `[positions[0],
      // positions[2] + 1)` — which for a codon stitched across an exon boundary
      // is its whole span including the intron, deliberately: it draws a cell at
      // each end and either can be the visible one.
      if (codon.positions[2] < bpLo || codon.positions[0] >= bpHi) {
        continue
      }
      const locs = locateCodon(codon.positions, blocks, indexes)
      if (!locs) {
        continue
      }
      // Resolved on first ask and kept — see `LocatedCodon.cells`. Not resolved
      // eagerly here: a codon whose reference base is gapped emits nothing at
      // all, and neither consumer reaches the cells for it.
      let cellsCache: CodonCell[] | undefined
      yield {
        displayedRegionIndex,
        codon,
        refBytes: refCodonBytes(locs, blocks),
        bpToPx,
        cells: () => (cellsCache ??= codonCells(codon.positions, bpToPx)),
        // A species must appear in every block the codon spans; iterate the rows
        // of the block holding its first (lowest) base and pull the other bases
        // from their blocks (all the same block in the common single-block case).
        *rows() {
          for (const row of blocks[locs[0].blockIdx]!.rows) {
            const bytes = rowCodonBytes(locs, indexes, row.rowIndex)
            if (bytes) {
              yield { rowIndex: row.rowIndex, bytes }
            }
          }
        },
      }
    }
  }
}

/**
 * The spine as a list, so the codon overlay and the conservation band share one
 * resolution pass instead of each re-enumerating the anchor's codons and
 * rebuilding every block's reference-column index. The model memoizes this
 * (`locatedCodons`), which is what makes the sharing real: with codon view and
 * codon conservation both on, that setup used to run twice per frame.
 */
export function locateVisibleCodons(
  params: LocateVisibleCodonsParams,
): LocatedCodon[] {
  return [...eachLocatedCodon(params)]
}

/**
 * The reference triplet of a located codon, read 5'→3' in the gene direction.
 * Undefined when the reference is gapped there (no codon to compare against).
 */
function refTriplet(located: LocatedCodon): string | undefined {
  return orientedTriplet(...located.refBytes, located.codon.strand)
}

/**
 * One display row's triplet at a located codon, in the same orientation as
 * `refTriplet` so the two are directly comparable. Undefined when that row has
 * no complete codon here — absent from a block the codon spans, or gapped at
 * one of its three bases.
 */
function rowTriplet(
  located: LocatedCodon,
  rowIndex: number,
): string | undefined {
  let triplet: string | undefined
  for (const row of located.rows()) {
    if (row.rowIndex === rowIndex) {
      triplet = orientedTriplet(...row.bytes, located.codon.strand)
      break
    }
  }
  return triplet
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
 * Returns undefined when the species codon has no amino acid (a non-standard
 * triplet, e.g. one containing `N`): syn vs nonsyn is undefined without both
 * residues, so the codon is left unclassified rather than guessed. Shared by the
 * codon overlay (`computeVisibleCodons`) and the hover lookup (`findCodonAt`) so
 * the colored cell and the tooltip can't disagree.
 *
 * `refAa` is passed rather than looked up because both callers resolve it before
 * they reach a row — one to skip an untranslatable reference codon entirely, the
 * other to report it — and the overlay calls this once per species per codon.
 */
function classifyChange(
  rowCodon: string,
  refCodon: string,
  refAa: string,
): { aa: string; change: CodonChange } | undefined {
  const aa = codonTable[rowCodon]
  if (aa === undefined) {
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
  return consecutiveRuns(positions).map(([startBp, endBp]) => ({
    ...bpSpanPx(bpToPx, startBp, endBp),
    x: bpToPx((startBp + endBp) / 2),
  }))
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
  codons: readonly LocatedCodon[],
  geometry: MafRowGeometryParams,
): CodonMarker[] {
  const { rowHeight, rowProportion, scrollTop, viewportHeight } = geometry
  const markers: CodonMarker[] = []
  const { h, offset } = rowBandGeometry(rowHeight, rowProportion, scrollTop)
  const { firstRow, endRow } = visibleRowRange(
    rowHeight,
    scrollTop,
    viewportHeight,
  )
  const hp2 = h / 2

  for (const located of codons) {
    const { codon, rows } = located
    const refCodon = refTriplet(located)
    // A reference codon with a gap/`N` has no amino acid to compare against,
    // so no species codon can be classified here (mirrors the conservation
    // band, which skips the same codon) — draw nothing rather than guess.
    const refAa = refCodon === undefined ? undefined : codonTable[refCodon]
    if (refCodon === undefined || refAa === undefined) {
      continue
    }
    const cells = located.cells()
    const glyphIdx = widestCell(cells)
    for (const { rowIndex, bytes } of rows()) {
      if (rowIndex < firstRow || rowIndex >= endRow) {
        continue
      }
      const rowCodon = orientedTriplet(...bytes, codon.strand)
      if (rowCodon === undefined) {
        continue
      }
      const cls = classifyChange(rowCodon, refCodon, refAa)
      if (!cls) {
        continue
      }
      const rowTop = offset + rowHeight * rowIndex
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
  codons: readonly LocatedCodon[],
  { refRowIndex }: ComputeCodonConservationParams,
): CodonConservationBar[] {
  const bars: CodonConservationBar[] = []
  for (const { codon, refBytes, cells, rows } of codons) {
    const refAa = translateCodonBytes(...refBytes, codon.strand)
    if (refAa === undefined) {
      continue
    }
    let matches = 0
    let classifiable = 0
    for (const { rowIndex, bytes } of rows()) {
      if (rowIndex !== refRowIndex) {
        const aa = translateCodonBytes(...bytes, codon.strand)
        if (aa) {
          classifiable += 1
          if (aa === refAa) {
            matches += 1
          }
        }
      }
    }
    const fraction = classifiable > 0 ? matches / classifiable : Number.NaN
    for (const cell of cells()) {
      bars.push({ xLeft: cell.xLeft, width: cell.width, fraction })
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
  /** the resolved spine, memoized by the display as `locatedCodons` */
  codons: readonly LocatedCodon[]
  /** the region the cursor is over — see `LocatedCodon.displayedRegionIndex` */
  displayedRegionIndex: number
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
 * the codon's three reference bases aren't all in the fetched blocks, the row is
 * absent, or the species' codon is gapped/non-standard there.
 *
 * Reads the same already-resolved codons the colored cells are drawn from, so
 * the tooltip and the cell agree structurally rather than by two code paths
 * being kept in step. It also makes hovering cheap: the enumerate + per-block
 * reference-column index + row-byte map this used to redo on every mousemove is
 * the expensive half, and the display already memoizes it (`locatedCodons`).
 */
export function findCodonAt(params: FindCodonAtParams): CodonHit | undefined {
  const { codons, displayedRegionIndex, bp, rowIndex } = params
  const located = codons.find(
    c =>
      c.displayedRegionIndex === displayedRegionIndex &&
      c.codon.positions.includes(bp),
  )
  let hit: CodonHit | undefined
  if (located) {
    const refCodon = refTriplet(located)
    const refAa = refCodon === undefined ? undefined : codonTable[refCodon]
    const rowCodon = rowTriplet(located, rowIndex)
    if (
      refCodon !== undefined &&
      refAa !== undefined &&
      rowCodon !== undefined
    ) {
      const cls = classifyChange(rowCodon, refCodon, refAa)
      if (cls) {
        hit = {
          codon: rowCodon,
          aa: cls.aa,
          refCodon,
          refAa,
          change: cls.change,
        }
      }
    }
  }
  return hit
}
