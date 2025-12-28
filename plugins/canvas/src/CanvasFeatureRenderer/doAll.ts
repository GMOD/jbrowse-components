import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'

import { layoutFeatures } from './layoutFeatures'
import { makeImageData } from './makeImageData'
import { fetchPeptideData } from './peptideUtils'
import { createRenderConfigContext } from './renderConfig'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

/**
 * Main rendering pipeline for CanvasFeatureRenderer
 *
 * IMPORTANT: Config values are read ONCE at the start via createRenderConfigContext()
 * and passed through the entire pipeline. This is critical for performance since
 * readConfObject() is expensive (JEXL evaluation, MobX reactions, tree traversal).
 *
 * DO NOT call readConfObject() in hot paths (per-feature loops). If you need a new
 * config value, add it to RenderConfigContext and createRenderConfigContext().
 */
export async function doAll({
  layout,
  features,
  renderProps,
  pluginManager,
}: {
  pluginManager: PluginManager
  layout: BaseLayout<unknown>
  features: Map<string, Feature>
  renderProps: RenderArgsDeserialized
}) {
  const { statusCallback = () => {}, regions, bpPerPx, config } = renderProps
  const region = regions[0]!
  const width = Math.max(1, (region.end - region.start) / bpPerPx)

  // Create config context ONCE at the start - this reads all config values upfront
  // to avoid expensive readConfObject calls in per-feature hot paths
  const configContext = createRenderConfigContext(config)

  const layoutRecords = await updateStatus(
    'Computing feature layout',
    statusCallback,
    async () => {
      return layoutFeatures({
        features,
        bpPerPx,
        region,
        configContext,
        layout,
        pluginManager,
      })
    },
  )

  const height = Math.max(1, layout.getTotalHeight())

  const peptideDataMap = await updateStatus(
    'Fetching peptide data',
    statusCallback,
    async () => {
      return fetchPeptideData(pluginManager, renderProps, features)
    },
  )

  return updateStatus('Rendering features', statusCallback, async () => {
    return renderToAbstractCanvas(width, height, renderProps, ctx =>
      makeImageData({
        ctx,
        layoutRecords,
        canvasWidth: width,
        renderArgs: {
          ...renderProps,
          features,
          layout,
          displayMode: configContext.displayMode,
          peptideDataMap,
          colorByCDS: (renderProps as any).colorByCDS,
          pluginManager,
        },
        configContext,
      }),
    )
  })
}
