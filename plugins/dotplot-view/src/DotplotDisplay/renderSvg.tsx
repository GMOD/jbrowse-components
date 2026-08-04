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
  dotplotRenderState: DotplotRenderState
}

// One track's dots, drawn into the plot area every display in the view shares.
// The terminal state belongs to the view (SVGDotplotView), not to this display:
// they all paint that same rect, so a per-display SVGErrorBox covered its
// siblings' dots — and its own stale geometry, which a failed refetch leaves on
// screen under the ErrorBanner. It is the hazard SVGSyntenyLevel documents for
// the equally non-LGV synteny display. No regionTooLarge state anywhere: the
// dotplot gates its fetch by LOD, not region size.
export async function renderSvg(
  model: DotplotRenderModel,
  opts?: PaintLayerOpts,
) {
  await awaitSvgReady(model)
  const view = getContainingView(model) as AbstractViewModel & RenderSvgView
  const { viewWidth, viewHeight, dotplotRenderState } = view
  const { geometry } = model
  return geometry ? (
    <PaintLayer
      width={viewWidth}
      height={viewHeight}
      opts={opts}
      paint={ctx => {
        const { viewBpH, viewBpV, bpPerPxHInv, bpPerPxVInv, lineWidth, alpha } =
          dotplotRenderState
        drawDotplotInstances(ctx, geometry, {
          viewBpH,
          bpPerPxHInv,
          viewBpV,
          bpPerPxVInv,
          viewWidth,
          viewHeight,
          lineWidth,
          alpha,
        })
      }}
    />
  ) : null
}
