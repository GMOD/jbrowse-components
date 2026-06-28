import {
  clipBlockForCanvas,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import { rowBandGeometry } from './visibleRegionGeometry.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// FNV-1a-ish string hash → 32-bit int. Deterministic per name so a given source
// chromosome always maps to the same color (independent of which chromosomes
// happen to be visible), which keeps the coloring + legend stable across zoom.
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  }
  return h
}

/**
 * Stable color for a source chromosome name, used by the color-by-chromosome SV
 * mode (a species' aligned blocks colored by which of its source chromosomes
 * each came from, so a translocation/rearrangement reads as a color change along
 * the row). Hash → hue spreads distinct names apart; the fixed mid saturation /
 * lightness reads on both light and dark track backgrounds.
 */
export function chromosomeColor(chr: string): string {
  const hue = ((hashString(chr) % 360) + 360) % 360
  return `hsl(${hue}, 62%, 55%)`
}

interface DrawSourceChromState {
  rowHeight: number
  rowProportion: number
  /** display row count */
  nRows: number
  canvasWidth: number
}

/**
 * Color-by-source-chromosome rendering over the (cleared) GPU base canvas: each
 * species row's alignment blocks are filled by the color of their source
 * chromosome (`MafAlignedRow.chr`, already shipped — no extra fetch). A row whose
 * blocks across the window come from different source chromosomes changes color,
 * surfacing translocations/rearrangements without explicit SV calling (MCGV-style).
 * Replaces the base SNP rendering when active (see `activeRowRendering`), so it
 * draws solid; rows with no `chr` are left untouched. Shared by the on-screen
 * canvas and SVG export, like `drawRowIdentity`.
 */
export function drawSourceChrom(
  ctx: Ctx2D,
  blocks: RenderBlock[],
  regions: ReadonlyMap<number, MafRegionData>,
  state: DrawSourceChromState,
) {
  const { rowHeight, rowProportion, nRows, canvasWidth } = state
  if (canvasWidth <= 0 || nRows <= 0) {
    return
  }
  const { h: bandH, offset: bandOffset } = rowBandGeometry(
    rowHeight,
    rowProportion,
  )
  for (const block of blocks) {
    const region = regions.get(block.displayedRegionIndex)
    if (region && clipBlockForCanvas(block, canvasWidth)) {
      const bpToX = makeBpMapper(block)
      for (const mafBlock of region.blocks) {
        const xa = bpToX(mafBlock.startBp)
        const xb = bpToX(mafBlock.endBp)
        const xLeft = Math.min(xa, xb)
        const w = Math.max(1, Math.abs(xb - xa))
        for (const row of mafBlock.rows) {
          if (row.rowIndex < nRows && row.chr) {
            ctx.fillStyle = chromosomeColor(row.chr)
            ctx.fillRect(xLeft, bandOffset + rowHeight * row.rowIndex, w, bandH)
          }
        }
      }
    }
  }
}
