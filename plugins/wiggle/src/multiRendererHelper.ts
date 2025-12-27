import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { MultiRenderArgsDeserialized } from './types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RenderReturn } from '@jbrowse/core/pluggableElementTypes/renderers/RendererType'
import type { Feature } from '@jbrowse/core/util'

type RenderFeaturesFn = (
  props: MultiRenderArgsDeserialized,
  features: Map<string, Feature>,
) => Promise<RenderReturn>

export async function renderMultiWiggle(
  pluginManager: PluginManager,
  renderProps: MultiRenderArgsDeserialized,
  renderFeatures: RenderFeaturesFn,
) {
  const { sessionId, adapterConfig, regions } = renderProps
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const region = regions[0]!

  const feats = await firstValueFrom(
    (dataAdapter as BaseFeatureDataAdapter)
      .getFeatures(region, renderProps)
      .pipe(toArray()),
  )
  const features = new Map(feats.map(f => [f.id(), f] as const))
  return renderFeatures(renderProps, features)
}
