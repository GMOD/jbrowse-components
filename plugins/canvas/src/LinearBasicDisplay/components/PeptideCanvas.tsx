import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { shouldRenderPeptideText } from '../../RenderFeatureDataRPC/zoomThresholds.ts'
import { drawPeptidesForRegions } from './peptidePositioning.ts'

import type { FeatureDataResult } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { VisibleRegion } from './hitTesting.ts'

// Amino-acid letters drawn straight onto a 2D canvas (one fillText per residue)
// rather than one absolutely-positioned <div> per residue — the same approach
// the alignments pileup uses for its base letters. At peptide zoom a dense CDS
// region can produce thousands of residues, so the canvas avoids that many
// React-reconciled DOM nodes per pan/zoom frame.
//
// The canvas lives in the scrolling content (sized to its full height) and is
// painted in absolute track coordinates, so it scrolls natively with the
// glyphs exactly like the old overlay divs did — no per-scroll redraw.
//
// `OverlayCanvas` owns the ref/effect/dpr/positioning ritual (see its docstring:
// this component was one of the hand-rolled copies it was extracted from, and
// drifted back into being one). Everything the draw reads is destructured in the
// render body, because the closure runs inside an effect where nothing is
// tracked — those reads are what repaint on a refetch or a pan.
const PeptideCanvas = observer(function PeptideCanvas({
  renderDataMap,
  visibleRegions,
  viewInitialized,
  width,
  height,
  bpPerPx,
}: {
  renderDataMap: ReadonlyMap<number, FeatureDataResult>
  visibleRegions: VisibleRegion[]
  viewInitialized: boolean
  width: number | undefined
  height: number
  bpPerPx: number
}) {
  return viewInitialized &&
    width &&
    bpPerPx &&
    shouldRenderPeptideText(bpPerPx) &&
    visibleRegions.length > 0 ? (
    <OverlayCanvas
      width={width}
      height={height}
      draw={ctx => {
        drawPeptidesForRegions(ctx, renderDataMap, visibleRegions)
      }}
    />
  ) : null
})

export default PeptideCanvas
