import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { MultiLinearWiggleDisplayModel } from './model.ts'
import type { WiggleDataResult, WiggleSourceData } from '@jbrowse/wiggle-core'

// A minimal but fully-typed zero-feature source: enough to populate
// `sourcesWithoutLayout` (which is what unblocks clustering and the row-count
// menu gates), with no features to render.
export function makeSource(name: string): WiggleSourceData {
  return {
    name,
    featurePositions: new Uint32Array(0),
    featureScores: new Float32Array(0),
    featureMinScores: new Float32Array(0),
    featureMaxScores: new Float32Array(0),
    numFeatures: 0,
    hasSummaryScores: false,
    posFeaturePositions: new Uint32Array(0),
    posFeatureScores: new Float32Array(0),
    posNumFeatures: 0,
    negFeaturePositions: new Uint32Array(0),
    negFeatureScores: new Float32Array(0),
    negNumFeatures: 0,
  }
}

// RenderMultiWiggleData is batched — one call for every visible region — so the
// result is an array with one entry per requested region.
export function makeMultiWiggleData(...names: string[]): WiggleDataResult[] {
  return [{ sources: names.map(makeSource) }]
}

// Shared display-instantiation harness: builds a PluginManager with a
// MultiQuantitativeTrack + MultiLinearWiggleDisplay and a minimal
// session/assemblyManager so a real display model can be created and driven in
// unit tests. createDisplay accepts extra display-snapshot props so tests can
// seed persistent state (e.g. runClustering) declaratively, exactly as the app
// does via addView.
// The shared display harness wired for the multi-wiggle display.
// `createDisplay(snapshot)` takes display-instance keys, which is how the
// clustering and sort autorun tests seed `runClustering`.
export function createTestEnvironment() {
  const env = createDisplayTestEnvironment<MultiLinearWiggleDisplayModel>({
    trackType: 'MultiQuantitativeTrack',
    adapter: { name: 'MultiWiggleAdapter', capabilities: ['hasResolution'] },
    displayName: 'MultiLinearWiggleDisplay',
    configSchema: () => configSchema,
    stateModel: (_pm, schema) => stateModelFactory(schema),
    viewModel: linearGenomeViewStateModelFactory,
    viewRegionEnd: 10_000,
  })
  return {
    ...env,
    createDisplay: (displaySnapshot?: Record<string, unknown>) =>
      env.createDisplay({ displaySnapshot }),
  }
}
