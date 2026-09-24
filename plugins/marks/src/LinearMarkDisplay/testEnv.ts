import {
  facetLayers,
  runTransforms,
} from '@jbrowse/core/util/featureTransforms'
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import WigglePlugin from '@jbrowse/plugin-wiggle'

import { configSchemaFactory } from './configSchema.ts'
import { stateModelFactory } from './model.ts'

import type { LinearMarkDisplayModel } from './model.ts'
import type { EncodedFeaturesResult } from '@jbrowse/core/util/markEncoding'
import type { Feature } from '@jbrowse/core/util/simpleFeature'

export const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}

export function createTestEnvironment(
  displayConfig: Record<string, unknown>,
  region = REGION,
) {
  return createDisplayTestEnvironment<LinearMarkDisplayModel>({
    plugins: [new LinearGenomeViewPlugin(), new WigglePlugin()],
    trackType: 'FeatureTrack',
    adapter: { name: 'BedAdapter', config: { type: 'BedAdapter' } },
    displayName: 'LinearMarkDisplay',
    configSchema: () => configSchemaFactory(),
    stateModel: (pm, schema) => stateModelFactory(pm, schema),
    viewModel: linearGenomeViewStateModelFactory,
    displayConfig,
    regions: [region],
    assemblyRegions: [region],
    onViewReady: view => {
      view.showAllRegions()
    },
  })
}

export function features(
  records: ({ start: number; end: number } & Record<string, unknown>)[],
): Feature[] {
  return records.map(
    (data, i) =>
      new SimpleFeature({ uniqueId: `f${i}`, refName: 'ctgA', ...data }),
  )
}

/**
 * What the worker answers the display's own request with over `feats`: the
 * shared steps, the facet split and each layer's encode, as
 * `CoreEncodeFeatures` runs them for a layer naming no row of its own.
 */
export function workerResult(
  display: LinearMarkDisplayModel,
  feats: readonly Feature[],
): EncodedFeaturesResult {
  const { layers, transform, facet } = display.rpcProps()
  const shared = runTransforms(feats, transform)
  const split = facet
    ? facetLayers(
        shared,
        facet,
        layers.map(l => ({ transform: l.transform, row: undefined })),
      )
    : undefined
  return {
    layers: layers.map((request, i) => {
      const own = split?.layers[i]
      return encodeFeatures(
        own?.features ?? runTransforms(shared, request.transform ?? []),
        { ...request.encoding, row: own?.rows },
        request.lanes,
      )
    }),
    facet: split?.sections,
  }
}
