import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { shouldRenderPeptideText } from '../../RenderFeatureDataRPC/zoomThresholds.ts'
import { labelCullBand } from './labelPositioning.ts'
import { drawPeptidesForRegions } from './peptidePositioning.ts'

import type { FeatureDataResult } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { VisibleRegion } from './hitTesting.ts'

// Sized to the label layer's scroll band rather than the whole stack: a canvas
// as tall as the content blows the backing-store cap and blurs the letters, and
// repaints every row on every data change. The band moves only when the scroll
// bucket does.
//
// Everything the draw closure reads is destructured in the render body: the
// closure itself runs inside an effect, where MobX tracks nothing.
const PeptideCanvas = observer(function PeptideCanvas({
  renderDataMap,
  visibleRegions,
  viewInitialized,
  width,
  contentHeight,
  viewportHeight,
  scrollBucket,
  bpPerPx,
}: {
  renderDataMap: ReadonlyMap<number, FeatureDataResult>
  visibleRegions: VisibleRegion[]
  viewInitialized: boolean
  width: number | undefined
  contentHeight: number
  viewportHeight: number
  scrollBucket: number
  bpPerPx: number
}) {
  const cullBand = labelCullBand(scrollBucket, viewportHeight)
  const top = Math.max(0, cullBand.top)
  const bottom = Math.min(contentHeight, cullBand.bottom)
  return viewInitialized &&
    width &&
    bpPerPx &&
    shouldRenderPeptideText(bpPerPx) &&
    visibleRegions.length > 0 ? (
    <OverlayCanvas
      width={width}
      height={Math.max(0, bottom - top)}
      top={top}
      draw={ctx => {
        ctx.translate(0, -top)
        drawPeptidesForRegions(ctx, renderDataMap, visibleRegions, {
          top,
          bottom,
        })
      }}
    />
  ) : null
})

export default PeptideCanvas
