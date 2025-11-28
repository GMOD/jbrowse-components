import { readConfObject } from '@jbrowse/core/configuration'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'

import { computeLayouts } from './computeLayouts'
import { makeImageData } from './makeImageData'
import { fetchPeptideData } from './peptideUtils'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { GranularRectLayout } from '@jbrowse/core/util/layouts'

export async function doAll({
  layout,
  features,
  renderProps,
  pluginManager,
}: {
  pluginManager: PluginManager
  layout: GranularRectLayout<unknown>
  features: Map<string, Feature>
  renderProps: RenderArgsDeserialized
}) {
  const { statusCallback = () => {}, regions, bpPerPx, config } = renderProps
  const region = regions[0]!
  const width = Math.max(1, (region.end - region.start) / bpPerPx)

  // Compute layouts for all features
  const layoutRecords = await updateStatus(
    'Computing feature layout',
    statusCallback,
    async () => {
      return computeLayouts({
        features,
        bpPerPx,
        region,
        config,
        layout,
      })
    },
  )

  const height = Math.max(1, layout.getTotalHeight())

  // Fetch peptide data for CDS features
  const peptideDataMap = await updateStatus(
    'Fetching peptide data',
    statusCallback,
    async () => {
      return fetchPeptideData(pluginManager, renderProps, features)
    },
  )

  // Render to canvas
  return updateStatus('Rendering features', statusCallback, async () => {
    const displayMode = readConfObject(config, 'displayMode') as string
    return renderToAbstractCanvas(width, height, renderProps, ctx =>
      makeImageData({
        ctx,
        layoutRecords,
        canvasWidth: width,
        renderArgs: {
          ...renderProps,
          features,
          layout,
          displayMode,
          peptideDataMap,
          colorByCDS: (renderProps as any).colorByCDS,
        },
      }),
    )
  })
}
