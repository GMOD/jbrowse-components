import { createJBrowseTheme } from '@jbrowse/core/ui'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { layoutFeatures } from './layoutFeatures'
import { makeImageData } from './makeImageData'
import { fetchPeptideData } from './peptideUtils'
import { createRenderConfigContext } from './renderConfig'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

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
  const {
    statusCallback = () => {},
    regions,
    bpPerPx,
    config,
    theme,
  } = renderProps
  const region = regions[0]!
  const width = Math.max(1, (region.end - region.start) / bpPerPx)

  // Get config as plain snapshot for fast static reads (zero MobX overhead)
  const configSnapshot = isStateTreeNode(config)
    ? getSnapshot(config)
    : (config as Record<string, any>)

  // Get jexl instance for evaluating callbacks
  const jexl = pluginManager.jexl

  // Create config context ONCE at the start - this reads all config values upfront
  // to avoid expensive readConfObject calls in per-feature hot paths
  const configContext = createRenderConfigContext(configSnapshot, region)

  const layoutRecords = await updateStatus(
    'Computing feature layout',
    statusCallback,
    async () => {
      return layoutFeatures({
        features,
        bpPerPx,
        region,
        configSnapshot,
        configContext,
        layout,
        theme: createJBrowseTheme(theme),
        jexl,
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
          features,
          layout,
          regions,
          bpPerPx,
          configSnapshot,
          displayMode: configContext.displayMode,
          theme,
          jexl,
          stopToken: renderProps.stopToken,
          peptideDataMap,
          colorByCDS: (renderProps as any).colorByCDS,
          pluginManager,
        },
        configContext,
      }),
    )
  })
}
