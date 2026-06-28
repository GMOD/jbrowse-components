import { MIN_HEIGHT_FOR_TEXT } from '@jbrowse/alignments-core'
import { codonTable } from '@jbrowse/core/util'

import { eachVisibleRegion, rowBandGeometry } from './visibleRegionGeometry.ts'
import { CHAR_SIZE_WIDTH } from '../../LinearMafRenderer/rendering/types.ts'
import { DASH, LOWER_BIT, SPACE } from '../../util/asciiBytes.ts'

import type { VisibleRegionsView } from './visibleRegionGeometry.ts'
import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafFrameRecord } from '../../types.ts'

export interface CodonMarker {
  /** screen px center of the codon (its middle reference base) */
  x: number
  /** baseline-center y of the amino-acid glyph */
  y: number
  /** single-letter amino acid (`*` = stop) */
  aa: string
  /** the residue differs from the reference (anchor) residue → nonsynonymous */
  differsFromRef: boolean
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

/**
 * Per-species amino-acid residues for the codon-translation overlay: each
 * reference codon (from the anchor `mafFrames`) translated in every aligned
 * species, drawn centered on the codon. The anchor residue is translated first;
 * a species residue that differs is flagged `differsFromRef` so nonsynonymous
 * substitutions stand out, while the underlying SNP cell coloring still shows
 * whether the nucleotide changed (a colored cell under an unchanged residue =
 * synonymous). Mirrors `computeVisibleLabels`' block/row walk + zoom gate; only
 * emits once a codon is wide enough to fit a glyph.
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
  // A codon spans 3 reference bases; require room for one glyph across them.
  if (3 / view.bpPerPx < CHAR_SIZE_WIDTH || h < MIN_HEIGHT_FOR_TEXT) {
    return markers
  }
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
        const refAa = translateCodonBytes(
          block.refSeqBytes[c0]!,
          block.refSeqBytes[c1]!,
          block.refSeqBytes[c2]!,
          codon.strand,
        )
        // center on the middle reference base
        const x = bpToPx(codon.p0 + 1.5)
        for (const row of block.rows) {
          const aa = translateCodonBytes(
            row.alignmentBytes[c0]!,
            row.alignmentBytes[c1]!,
            row.alignmentBytes[c2]!,
            codon.strand,
          )
          if (aa === undefined) {
            continue
          }
          markers.push({
            x,
            y: Math.round(hp2 + offset + rowHeight * row.rowIndex),
            aa,
            differsFromRef: refAa !== undefined && aa !== refAa,
          })
        }
      }
    }
  }
  return markers
}
