import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { drawLine } from '../drawLine.ts'
import {
  forEachSourceFeatures,
  getAdaptersForPerSourceRendering,
} from '../multiRendererHelper.ts'
import { serializeWiggleFeature } from '../util.ts'

import type { MultiRenderArgsDeserialized } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

export async function renderMultiLine(
  renderProps: MultiRenderArgsDeserialized,
  pluginManager: PluginManager,
) {
  const {
    sources,
    height,
    regions,
    bpPerPx,
    stopToken,
    statusCallback = () => {},
  } = renderProps

  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx
  const lastCheck = createStopTokenChecker(stopToken)

  const adapterBySource = await getAdaptersForPerSourceRendering(
    pluginManager,
    renderProps,
  )

  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, async ctx => {
        let feats: Feature[] = []

        await forEachSourceFeatures(
          adapterBySource,
          sources,
          region,
          renderProps,
          (source, features) => {
            const { reducedFeatures } = drawLine(ctx, {
              ...renderProps,
              features,
              staticColor: source.color || 'blue',
              colorCallback: () => '', // unused when staticColor is set
              lastCheck,
            })
            feats = feats.concat(reducedFeatures)
          },
        )

        return { reducedFeatures: feats }
      }),
  )

  const serialized = {
    ...rest,
    features: reducedFeatures.map(serializeWiggleFeature),
    height,
    width,
  }

  return rpcResult(serialized, collectTransferables(rest))
}
