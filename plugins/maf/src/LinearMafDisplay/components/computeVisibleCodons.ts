import { codonTable } from '@jbrowse/core/util'

import { eachVisibleRegion, rowBandGeometry } from './visibleRegionGeometry.ts'
import { DASH, LOWER_BIT, SPACE } from '../../util/asciiBytes.ts'

import type { VisibleRegionsView } from './visibleRegionGeometry.ts'
import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
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
  /** left px of the 3-base codon cell */
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
}

/** A reference codon: three consecutive reference positions + reading strand. */
export interface Codon {
  p0: number
  strand: number
}

const COMPLEMENT: Record<string, string> = {
  A: 'T',
  T: 'A',
  G: 'C',
  C: 'G',
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
  const triplet =
    strand === -1
      ? `${COMPLEMENT[c2] ?? ''}${COMPLEMENT[c1] ?? ''}${COMPLEMENT[c0] ?? ''}`
      : `${c0}${c1}${c2}`
  return codonTable[triplet]
}

/**
 * The reference codons defined by the anchor species' `mafFrames` records. Each
 * record's `frame` is the codon position (0/1/2) of its first base (`+`) or last
 * base (`−`); the leading partial codon is skipped (`(3 − frame) % 3` bases),
 * then full codons proceed in transcription order. Codons crossing an exon/block
 * boundary aren't reconstructed in this pass (UCSC borrows flanking bases via
 * `prevFramePos`/`nextFramePos`; here that boundary codon is simply omitted).
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
    const skip = (3 - (f.frame % 3)) % 3
    if (f.strand === -1) {
      // read right→left: rightmost `skip` bases are the leading partial codon
      for (let end = f.end - skip; end - 3 >= f.start; end -= 3) {
        codons.push({ p0: end - 3, strand: -1 })
      }
    } else {
      for (let p0 = f.start + skip; p0 + 3 <= f.end; p0 += 3) {
        codons.push({ p0, strand: 1 })
      }
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

// Case-insensitive equality of two alignment bytes (ASCII letter-case bit).
function sameBase(a: number, b: number) {
  return (a & ~LOWER_BIT) === (b & ~LOWER_BIT)
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

    for (const block of regionData.blocks) {
      // Built lazily on the first codon that overlaps this block, so blocks
      // outside the CDS (no codons) skip the Int32Array allocation entirely.
      let refColumns: Int32Array | undefined
      const n = block.endBp - block.startBp
      for (const codon of codons) {
        const g0 = codon.p0 - block.startBp
        if (g0 < 0 || g0 + 2 >= n) {
          continue
        }
        refColumns ??= buildRefColumns(block.refSeqBytes)
        const c0 = refColumns[g0]!
        const c1 = refColumns[g0 + 1]!
        const c2 = refColumns[g0 + 2]!
        const ref = block.refSeqBytes
        const refAa = translateCodonBytes(ref[c0]!, ref[c1]!, ref[c2]!, codon.strand)
        // 3-base cell span + middle-base center, orientation-aware via bpToPx
        const xa = bpToPx(codon.p0)
        const xb = bpToPx(codon.p0 + 3)
        const xLeft = Math.min(xa, xb)
        const width = Math.abs(xb - xa)
        const x = bpToPx(codon.p0 + 1.5)
        for (const row of block.rows) {
          const a = row.alignmentBytes
          const aa = translateCodonBytes(a[c0]!, a[c1]!, a[c2]!, codon.strand)
          if (aa === undefined) {
            continue
          }
          const change: CodonChange =
            aa === '*'
              ? 'stop'
              : refAa !== undefined && aa !== refAa
                ? 'nonsyn'
                : sameBase(a[c0]!, ref[c0]!) &&
                    sameBase(a[c1]!, ref[c1]!) &&
                    sameBase(a[c2]!, ref[c2]!)
                  ? 'same'
                  : 'syn'
          markers.push({
            xLeft,
            width,
            rowTop: offset + rowHeight * row.rowIndex,
            h,
            x,
            y: Math.round(hp2 + offset + rowHeight * row.rowIndex),
            aa,
            change,
          })
        }
      }
    }
  }
  return markers
}
