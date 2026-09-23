import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { LinearWiggleDisplayModel } from './model.ts'
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
  }
}

// RenderMultiWiggleData is batched — one call for every visible region — so the
// result is an array with one entry per requested region.
export function makeMultiWiggleData(...names: string[]): WiggleDataResult[] {
  return [{ sources: names.map(makeSource) }]
}

// The shared display harness wired for the quantitative display, on a
// MultiQuantitativeTrack so the multi-source adapter's capabilities are the
// ones declared. `createDisplay(snapshot)` takes display-instance keys, which
// is how the clustering and sort autorun tests seed `runClustering`;
// `displayConfig` takes config slots, for the ones with no setter
// (`rows.domain`).
//
// The track type's own display defaults are a Core-preProcessTrackConfig
// handler this bare harness does not install, so a test that wants one row per
// source calls `setRowLayout(true)`.
export function createTestEnvironment({
  displayConfig,
}: { displayConfig?: Record<string, unknown> } = {}) {
  const env = createDisplayTestEnvironment<LinearWiggleDisplayModel>({
    trackType: 'MultiQuantitativeTrack',
    adapter: { name: 'MultiWiggleAdapter', capabilities: ['hasResolution'] },
    displayName: 'LinearWiggleDisplay',
    configSchema: () => configSchema,
    stateModel: (pm, schema) => stateModelFactory(pm, schema),
    viewModel: linearGenomeViewStateModelFactory,
    viewRegionEnd: 10_000,
    displayConfig,
  })
  return {
    ...env,
    createDisplay: (displaySnapshot?: Record<string, unknown>) =>
      env.createDisplay({ displaySnapshot }),
  }
}
