import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { shouldRenderPeptideText } from '../../RenderFeatureDataRPC/zoomThresholds.ts'
import { drawPeptidesForRegions } from './peptidePositioning.ts'

import type { FeatureDataResult } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { VisibleRegion } from './hitTesting.ts'

// Everything the draw closure reads is destructured in the render body: the
// closure itself runs inside an effect, where MobX tracks nothing.
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
