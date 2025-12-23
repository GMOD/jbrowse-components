import { createJBrowseTheme } from '@jbrowse/core/ui'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'

import { computeLayouts } from './computeLayouts'
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

  // Create config context ONCE at the start - this reads all config values upfront
  // to avoid expensive readConfObject calls in per-feature hot paths
  const configContext = createRenderConfigContext(config)

  const layoutRecords = await updateStatus(
    'Computing feature layout',
    statusCallback,
    async () => {
      return computeLayouts({
        features,
        bpPerPx,
        region,
        config,
        configContext,
        layout,
        theme: createJBrowseTheme(theme),
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
