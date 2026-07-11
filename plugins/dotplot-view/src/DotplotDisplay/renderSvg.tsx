import { SVGErrorBox } from '@jbrowse/core/svg/SvgExport'
import { awaitSvgReady } from '@jbrowse/core/svg/svgReady'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'

import { drawDotplotInstances } from './drawDotplot.ts'

import type { DotplotRenderState } from './dotplotRenderingBackendTypes.ts'
import type { DotplotRenderModel } from './types.ts'
import type { PaintLayerOpts } from '@jbrowse/core/util/paintLayer'

// Minimal structural view type instead of DotplotViewModel: this file is in
// the display model's return-type inference path, so importing the view model
// (which references the display model) forms a cycle that collapses the whole
// model type to `any`. Keep it structural. `dotplotRenderState` is the same
// transform the on-screen canvas/GPU path consumes, so SVG export can't drift
// from what's on screen.
interface RenderSvgView {
  viewWidth: number
  viewHeight: number
  dotplotRenderState: DotplotRenderState | undefined
}

export async function renderSvg(
  model: DotplotRenderModel,
  opts?: PaintLayerOpts,
) {
  await awaitSvgReady(model)
  const view = getContainingView(model) as unknown as RenderSvgView
  const { viewWidth, viewHeight, dotplotRenderState } = view
  if (model.error) {
    return (
      <SVGErrorBox error={model.error} width={viewWidth} height={viewHeight} />
    )
  }
  const { geometry } = model
  if (!geometry || !dotplotRenderState) {
    return null
  }
  const { viewBpH, viewBpV, bpPerPxHInv, bpPerPxVInv, lineWidth } =
    dotplotRenderState
  return paintLayer(viewWidth, viewHeight, opts, ctx => {
    drawDotplotInstances(ctx, geometry, {
      viewBpH,
      bpPerPxHInv,
      viewBpV,
      bpPerPxVInv,
      viewHeight,
      lineWidth,
    })
  })
}
