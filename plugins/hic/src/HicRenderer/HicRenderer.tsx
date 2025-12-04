import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import ServerSideRendererType from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { renderToAbstractCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import { rpcResult } from 'librpc-web-mod'

import type { MultiRegionContactRecord } from '../HicAdapter/HicAdapter'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { RenderArgsDeserialized as ServerSideRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import type { Region } from '@jbrowse/core/util/types'

export type HicFeature = MultiRegionContactRecord

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

export interface RenderArgsDeserializedWithFeatures extends RenderArgsDeserialized {
  features: HicFeature[]
  statusCallback?: (arg: string) => void
}

interface HicAdapter {
  getMultiRegionContactRecords: (
    regions: Region[],
    opts: Record<string, unknown>,
  ) => Promise<MultiRegionContactRecord[]>
}

export default class HicRenderer extends ServerSideRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const { displayHeight, regions, bpPerPx } = renderProps

    // Calculate total width across all regions
    let totalWidthBp = 0
    for (const region of regions) {
      totalWidthBp += region.end - region.start
    }
    const width = totalWidthBp / bpPerPx
    const hyp = width / 2
    const height = displayHeight ?? hyp
    const features = await this.getFeatures(renderProps)

    const { makeImageData } = await import('./makeImageData')
    const res = await renderToAbstractCanvas(width, height, renderProps, ctx =>
      makeImageData(ctx, {
        ...renderProps,
        yScalar: height / Math.max(height, hyp),
        features,
        pluginManager: this.pluginManager,
      }),
    )

    const serialized = { ...res, height, width }
    return rpcResult(serialized, collectTransferables(res))
  }

  async getFeatures(args: RenderArgsDeserialized) {
    const { regions, sessionId, adapterConfig } = args
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    return (dataAdapter as unknown as HicAdapter).getMultiRegionContactRecords(
      regions,
      args,
    )
  }
}
