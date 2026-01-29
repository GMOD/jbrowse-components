import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { drawDensity } from '../drawDensity.ts'
import { forEachSourceFeatures } from '../multiRendererHelper.ts'
import { serializeWiggleFeature } from '../util.ts'

import type { MultiRenderArgsDeserialized } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

export async function renderMultiDensity(
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
  const rowHeight = height / sources.length
  const lastCheck = createStopTokenChecker(stopToken)

  const { reducedFeatures, ...rest } = await updateStatus(
    'Rendering plot',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, height, renderProps, async ctx => {
        let feats: Feature[] = []
        ctx.save()

        await forEachSourceFeatures(pluginManager, renderProps, (source, features) => {
          const { reducedFeatures } = drawDensity(ctx, {
            ...renderProps,
            features,
            height: rowHeight,
            lastCheck,
          })
          ctx.translate(0, rowHeight)
          feats = feats.concat(reducedFeatures)
        })

        ctx.restore()
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
