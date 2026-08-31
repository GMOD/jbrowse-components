import { awaitSvgReady } from '@jbrowse/core/svg/svgReady'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'

import { drawSyntenyTrack } from './Canvas2DSyntenyRenderer.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { SyntenyTrackRenderParams } from './syntenyRenderingBackendTypes.ts'
import type { PaintLayerOpts } from '@jbrowse/core/util/paintLayer'

// Exactly what the export reads off LinearSyntenyDisplay — duck-typed, as the
// other GPU displays' renderSvg models are, so the compiler catches a missing
// field and a test can drive this without standing up an MST tree. No
// `regionTooLarge`: synteny has no too-large state.
export interface SyntenySvgModel {
  svgReady: boolean
  error: unknown
  height: number
  renderInstanceData: SyntenyInstanceData | undefined
  renderParams: SyntenyTrackRenderParams | undefined
  view: { width: number; overdrawPx: number }
  /** the band the level cleared to, which the indel wedges are blended against */
  groundColor: string
}

// One synteny track's ribbons, drawn into the band its level owns. A failed
// track fails the export rather than drawing anything: every display in a level
// paints over that same full-height band, so a message here is a message over
// the siblings that rendered. `SVGLinearSyntenyView` fans these out through
// `awaitSvgRenders`, so every failed ribbon track is named, not just this one.
export async function renderSvg(model: SyntenySvgModel, opts?: PaintLayerOpts) {
  await awaitSvgReady(model)
  const { view } = model
  const data = model.renderInstanceData
  const params = model.renderParams
  // PaintLayer dispatches to a 2× raster canvas when opts.rasterizeLayers is
  // set, falling back to SvgCanvas otherwise. drawSyntenyTrack duck-types
  // against either Ctx2D variant and draws in logical coords (PaintLayer's
  // canvas is pre-scaled), so the same draw path runs identically here and in
  // the interactive Canvas2D backend. Horizontal overdraw is clipped by the
  // enclosing SVGSyntenyLevel's SvgClipRect, so no per-display clip is needed.
  // Narrow the genuinely-nullable derived data (undefined until instanceData +
  // colors resolve); no data-size gate — drawSyntenyTrack draws nothing for an
  // instanceCount of 0, so an empty level paints empty naturally.
  return data && params ? (
    <PaintLayer
      width={view.width}
      height={model.height}
      opts={opts}
      paint={ctx => {
        drawSyntenyTrack(
          ctx,
          data,
          params,
          view.width,
          view.overdrawPx,
          model.groundColor,
        )
      }}
    />
  ) : null
}
