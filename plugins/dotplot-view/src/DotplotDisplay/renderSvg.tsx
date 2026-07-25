import { SVGErrorBox } from '@jbrowse/core/svg/SvgExport'
import { awaitSvgReady } from '@jbrowse/core/svg/svgReady'
import { getContainingView } from '@jbrowse/core/util'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'

import { drawDotplotInstances } from './drawDotplot.ts'

import type { DotplotRenderState } from './dotplotRenderingBackendTypes.ts'
import type { DotplotRenderModel } from './types.ts'
import type { AbstractViewModel } from '@jbrowse/core/util'
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
  const view = getContainingView(model) as AbstractViewModel & RenderSvgView
  const { viewWidth, viewHeight, dotplotRenderState } = view
  const { geometry, error } = model
  return error ? (
    <SVGErrorBox error={error} width={viewWidth} height={viewHeight} />
  ) : geometry && dotplotRenderState ? (
    <PaintLayer
      width={viewWidth}
      height={viewHeight}
      opts={opts}
      paint={ctx => {
        const { viewBpH, viewBpV, bpPerPxHInv, bpPerPxVInv, lineWidth } =
          dotplotRenderState
        drawDotplotInstances(ctx, geometry, {
          viewBpH,
          bpPerPxHInv,
          viewBpV,
          bpPerPxVInv,
          viewWidth,
          viewHeight,
          lineWidth,
        })
      }}
    />
  ) : null
}
