import { useEffect, useRef } from 'react'

import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { observer } from 'mobx-react'

import { drawPeptidesForRegions } from './peptidePositioning.ts'
import { shouldRenderPeptideText } from '../../RenderFeatureDataRPC/zoomThresholds.ts'

import type { VisibleRegion } from './hitTesting.ts'
import type { FeatureDataResult } from '../../RenderFeatureDataRPC/rpcTypes.ts'

// Amino-acid letters drawn straight onto a 2D canvas (one fillText per residue)
// rather than one absolutely-positioned <div> per residue — the same approach
// the alignments pileup uses for its base letters. At peptide zoom a dense CDS
// region can produce thousands of residues, so the canvas avoids that many
// React-reconciled DOM nodes per pan/zoom frame.
//
// The canvas lives in the scrolling content (sized to its full height) and is
// painted in absolute track coordinates, so it scrolls natively with the
// glyphs exactly like the old overlay divs did — no per-scroll redraw.
const PeptideCanvas = observer(function PeptideCanvas({
  renderDataMap,
  visibleRegions,
  viewInitialized,
  width,
  height,
  bpPerPx,
}: {
  renderDataMap: Map<number, FeatureDataResult>
  visibleRegions: VisibleRegion[]
  viewInitialized: boolean
  width: number | undefined
  height: number
  bpPerPx: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const show =
    viewInitialized &&
    !!width &&
    !!bpPerPx &&
    shouldRenderPeptideText(bpPerPx) &&
    visibleRegions.length > 0

  useEffect(() => {
    const ctx = getPreparedCanvas2D(canvasRef.current, width ?? 0, height)
    if (ctx && show) {
      drawPeptidesForRegions(ctx, renderDataMap, visibleRegions)
    }
  }, [renderDataMap, visibleRegions, width, height, bpPerPx, show])

  return show ? (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    />
  ) : null
})

export default PeptideCanvas
