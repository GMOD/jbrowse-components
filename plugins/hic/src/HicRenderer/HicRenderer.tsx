import ServerSideRendererType from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { renderToAbstractCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import { rpcResult } from 'librpc-web-mod'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { RenderArgsDeserialized as ServerSideRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import type { Region } from '@jbrowse/core/util/types'

export interface HicFeature {
  bin1: number
  bin2: number
  counts: number
}

export interface RenderArgsDeserialized extends ServerSideRenderArgsDeserialized {
  regions: Region[]
  bpPerPx: number
  highResolutionScaling: number
  resolution: number
  adapterConfig: AnyConfigurationModel
  displayHeight?: number
  useLogScale?: boolean
  colorScheme?: string
}

export default class HicRenderer extends ServerSideRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const { displayHeight, regions, bpPerPx } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx
    const hyp = width / 2
    const height = displayHeight ?? hyp

    const { makeImageData } = await import('./makeImageData')
    const res = await renderToAbstractCanvas(width, height, renderProps, ctx =>
      makeImageData(ctx, {
        ...renderProps,
        yScalar: height / Math.max(height, hyp),
        pluginManager: this.pluginManager,
      }),
    )

    return rpcResult({ ...res, height, width }, collectTransferables(res))
  }
}
