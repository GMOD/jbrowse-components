import { MIN_HEIGHT_FOR_TEXT } from '@jbrowse/alignments-core'
import { codonTable, complementTable } from '@jbrowse/core/util'
import { spanRect } from '@jbrowse/render-core/canvas2dUtils'

import { buildColumnForGenomicOffset } from '../LinearMafRenderer/binning.ts'
import { blockIndexAtBp } from '../LinearMafRenderer/blockAtBp.ts'
import { CHAR_SIZE_WIDTH } from '../LinearMafRenderer/rendering/types.ts'
import { LOWER_BIT, isNoBaseByte } from '../util/asciiBytes.ts'
import {
  eachVisibleRegion,
  rowViewport,
} from './components/visibleRegionGeometry.ts'

import type { GenomicColumns } from '../LinearMafRenderer/binning.ts'
import type {
  MafBlock,
  MafIdentityBars,
  MafRegionData,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafFrameRecord } from '../types.ts'
import type {
  MafRowGeometryParams,
  VisibleRegionsView,
} from './components/visibleRegionGeometry.ts'
import type { SpanChannels } from '@jbrowse/render-core/marks'

/**
 * How a species' codon compares to the reference (anchor) codon:
 * - `same` — identical codon (no change)
 * - `syn` — synonymous: nucleotides differ but the amino acid is unchanged
 * - `nonsyn` — nonsynonymous: the amino acid changed
 * - `stop` — the species reads a stop where the reference codes an amino acid
 */
export type CodonChange = 'same' | 'syn' | 'nonsyn' | 'stop'

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

/**
 * The three reference-column bytes of a codon as a single triplet string, read
 * in protein (transcription) orientation — reverse-complemented for a `−`-strand
 * gene so it lines up 5'→3' with the amino acid. Returns undefined when any
 * position is a gap/space (a gap/deletion in that species, so there's no codon).
 * Non-standard bases (`N`) are kept verbatim, so the triplet stays 3 chars for
 * display while `codonTable` still yields no amino acid for it.
 *
 * Core's `complementTable` rather than the local four-base map this carried,
 * which fell through to `N` for every IUPAC ambiguity code. Not a behavioural
 * fix, and worth saying so before someone reports it as one: every reader of a
 * triplet requires `codonTable[triplet]`, which holds only the 64 standard
 * codons, so an ambiguity code has no amino acid either way. `?? 'N'` stays for
 * a character that is not a base at all.
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
    ? `${complementTable[c2] ?? 'N'}${complementTable[c1] ?? 'N'}${complementTable[c0] ?? 'N'}`
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

/** A species codon classified against the reference's at one codon. */
export interface CodonCall {
  rowIndex: number
  /** the species' triplet, 5'→3' in the gene direction */
  codon: string
  /** its amino acid (`*` = stop) */
  aa: string
  change: CodonChange
}

/**
 * One reference codon resolved against its region's blocks, with every row's
 * call. Located once per region rather than per frame: nothing here depends
 * on the view.
 */
export interface LocatedCodon {
  /**
   * The region this codon was resolved in, since absolute genomic bp is unique
   * only within a displayed region.
   */
  displayedRegionIndex: number
  codon: Codon
  /**
   * `[startBp, endBp)` runs of consecutive reference positions: one, or two
   * for a codon stitched across an exon boundary.
   */
  runs: readonly (readonly [number, number])[]
  refCodon: string
  refAa: string
  calls: CodonCall[]
}

/**
 * Classify a species' codon against the reference codon, both oriented
 * uppercase triplets:
 * - `stop`   — the species codon is a stop the reference codon is not
 * - `nonsyn` — its amino acid differs from the reference's, a read-through of
 *   the reference's stop included
 * - `same`   — the two codons are nucleotide-identical
 * - `syn`    — silent: the nucleotides differ but the amino acid is unchanged
 *
 * Undefined where the species codon has no amino acid (e.g. an `N`), since syn
 * vs nonsyn needs both residues.
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
    aa === '*' && refAa !== '*'
      ? 'stop'
      : aa !== refAa
        ? 'nonsyn'
        : rowCodon === refCodon
          ? 'same'
          : 'syn'
  return { aa, change }
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
 * Every reference codon the anchor species' `mafFrames` define that the
 * region's blocks resolve, with each species' call. A reference codon with a
 * gap or `N` has no amino acid to compare against and is dropped; a species
 * absent from a block the codon spans, or gapped in it, has no call.
 */
export function locateRegionCodons(
  region: MafRegionData,
  frames: MafFrameRecord[],
  anchor: string,
  displayedRegionIndex: number,
): LocatedCodon[] {
  const { blocks } = region
  const indexes = new BlockIndexes(blocks)
  const located: LocatedCodon[] = []
  for (const codon of enumerateCodons(frames, anchor)) {
    const locs = locateCodon(codon.positions, blocks, indexes)
    const refCodon = locs
      ? orientedTriplet(...refCodonBytes(locs, blocks), codon.strand)
      : undefined
    const refAa = refCodon === undefined ? undefined : codonTable[refCodon]
    if (locs && refCodon !== undefined && refAa !== undefined) {
      const calls: CodonCall[] = []
      for (const row of blocks[locs[0].blockIdx]!.rows) {
        const bytes = rowCodonBytes(locs, indexes, row.rowIndex)
        const rowCodon = bytes && orientedTriplet(...bytes, codon.strand)
        const cls = rowCodon && classifyChange(rowCodon, refCodon, refAa)
        if (rowCodon && cls) {
          calls.push({ rowIndex: row.rowIndex, codon: rowCodon, ...cls })
        }
      }
      located.push({
        displayedRegionIndex,
        codon,
        runs: consecutiveRuns(codon.positions),
        refCodon,
        refAa,
        calls,
      })
    }
  }
  return located
}

/** Packed ABGR per change; `undefined` paints no cell. */
export type CodonFills = Record<CodonChange, number | undefined>

/**
 * The codon view's cells as `span` channels: one instance per run of each
 * call whose change takes a fill, so a conserved codon leaves its cell clean.
 */
export function encodeCodonSpans(
  codons: readonly LocatedCodon[],
  fills: CodonFills,
): SpanChannels {
  let count = 0
  for (const { runs, calls } of codons) {
    for (const call of calls) {
      if (fills[call.change] !== undefined) {
        count += runs.length
      }
    }
  }
  const x = new Uint32Array(count)
  const x2 = new Uint32Array(count)
  const row = new Uint32Array(count)
  const color = new Uint32Array(count)
  let i = 0
  for (const { runs, calls } of codons) {
    for (const call of calls) {
      const fill = fills[call.change]
      if (fill !== undefined) {
        for (const [start, end] of runs) {
          x[i] = start
          x2[i] = end
          row[i] = call.rowIndex
          color[i] = fill
          i++
        }
      }
    }
  }
  return { x, x2, row, color, count }
}

/**
 * The fraction of species other than the reference's row whose amino acid
 * matches the reference's at each codon: protein-level conservation, where a
 * synonymous substitution still reads as conserved. `NaN` where no such
 * species translates. `refRowIndex` -1 counts every row.
 */
export function codonConservation(
  { calls, refAa }: LocatedCodon,
  refRowIndex: number,
) {
  let matches = 0
  let classifiable = 0
  for (const call of calls) {
    if (call.rowIndex !== refRowIndex) {
      classifiable += 1
      if (call.aa === refAa) {
        matches += 1
      }
    }
  }
  return classifiable > 0 ? matches / classifiable : Number.NaN
}

/** The conservation band's codon mode: a bar per codon run, as tall as its conservation. */
export function encodeCodonConservation(
  codons: readonly LocatedCodon[],
  refRowIndex: number,
  color: number,
): MafIdentityBars {
  const bars: { start: number; end: number; y: number }[] = []
  for (const located of codons) {
    const y = codonConservation(located, refRowIndex)
    if (!Number.isNaN(y)) {
      for (const [start, end] of located.runs) {
        bars.push({ start, end, y })
      }
    }
  }
  return {
    x: Uint32Array.from(bars, b => b.start),
    x2: Uint32Array.from(bars, b => b.end),
    y: Float32Array.from(bars, b => b.y),
    row: new Uint32Array(bars.length),
    color: new Uint32Array(bars.length).fill(color),
    count: bars.length,
  }
}

/** An amino acid drawn over its codon's cell. */
export interface CodonGlyph {
  x: number
  y: number
  aa: string
}

/**
 * The amino-acid letters over the visible codons: one per call, on the widest
 * run of its codon, where that run is wide and tall enough to hold a letter.
 * The one per-frame part of the codon view, since a letter is placed in px.
 */
export function computeVisibleCodonGlyphs(
  view: VisibleRegionsView,
  codonsByRegion: { get(idx: number): readonly LocatedCodon[] | undefined },
  geometry: MafRowGeometryParams,
): CodonGlyph[] {
  const { rowHeight } = geometry
  const glyphs: CodonGlyph[] = []
  const { h, offset, firstRow, endRow } = rowViewport(geometry)
  if (h < MIN_HEIGHT_FOR_TEXT) {
    return glyphs
  }
  for (const { data: codons, bpToPx, overlaps } of eachVisibleRegion(
    view,
    codonsByRegion,
  )) {
    for (const { codon, runs, calls } of codons) {
      if (overlaps(codon.positions[0], codon.positions[2] + 1)) {
        let widest = { width: 0, x: 0 }
        for (const [start, end] of runs) {
          const { width } = spanRect(bpToPx, start, end, 1)
          if (width > widest.width) {
            widest = { width, x: bpToPx((start + end) / 2) }
          }
        }
        if (widest.width >= CHAR_SIZE_WIDTH) {
          for (const call of calls) {
            if (call.rowIndex >= firstRow && call.rowIndex < endRow) {
              glyphs.push({
                x: widest.x,
                y: Math.round(offset + rowHeight * call.rowIndex + h / 2),
                aa: call.aa,
              })
            }
          }
        }
      }
    }
  }
  return glyphs
}

/** A single species' codon resolved under the cursor, for the hover tooltip. */
export interface CodonHit {
  codon: string
  aa: string
  refCodon: string
  refAa: string
  change: CodonChange
}

/** The codon covering reference `bp` in one region, called on `rowIndex`. */
export function findCodonAt(
  codons: readonly LocatedCodon[] | undefined,
  bp: number,
  rowIndex: number,
): CodonHit | undefined {
  const located = codons?.find(c => c.codon.positions.includes(bp))
  const call = located?.calls.find(c => c.rowIndex === rowIndex)
  return located && call
    ? {
        codon: call.codon,
        aa: call.aa,
        refCodon: located.refCodon,
        refAa: located.refAa,
        change: call.change,
      }
    : undefined
}
