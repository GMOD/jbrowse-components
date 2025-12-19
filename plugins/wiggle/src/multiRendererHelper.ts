import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import type { MultiWiggleFeatureArrays } from './MultiWiggleAdapter/MultiWiggleAdapter'
import type { MultiRenderArgsDeserialized } from './types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RenderReturn } from '@jbrowse/core/pluggableElementTypes/renderers/RendererType'
import type { Feature } from '@jbrowse/core/util'

type RenderArraysFn = (
  props: MultiRenderArgsDeserialized,
  arraysBySource: MultiWiggleFeatureArrays,
) => Promise<RenderReturn>

type RenderFeaturesFn = (
  props: MultiRenderArgsDeserialized,
  features: Map<string, Feature>,
) => Promise<RenderReturn>

/**
 * Shared render logic for Multi* wiggle renderers.
 * Tries array-based rendering first for better performance,
 * falls back to feature-based rendering if arrays aren't available.
 */
export async function renderMultiWiggle(
  pluginManager: PluginManager,
  renderProps: MultiRenderArgsDeserialized,
  getFeatures: () => Promise<Map<string, Feature>>,
  renderArrays: RenderArraysFn,
  renderFeatures: RenderFeaturesFn,
) {
  const { sessionId, adapterConfig, regions } = renderProps
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const region = regions[0]!

  // Try array-based rendering for better performance
  if ('getFeaturesAsArrays' in dataAdapter) {
    const arraysBySource = await (dataAdapter as any).getFeaturesAsArrays(
      region,
      renderProps,
    )
    const allSourcesHaveArrays = renderProps.sources.every(
      s => arraysBySource[s.name],
    )
    if (allSourcesHaveArrays) {
      return renderArrays(renderProps, arraysBySource)
    }
  }

  // Fallback to feature-based rendering
  const features = await getFeatures()
  return renderFeatures(renderProps, features)
}
