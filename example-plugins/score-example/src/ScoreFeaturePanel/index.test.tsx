import PluginManager from '@jbrowse/core/PluginManager'

import ScoreFeaturePanelF from './index.tsx'

import type { FeaturePanelProps } from '@jbrowse/core/PluginManager'

function panelsFor(
  model: FeaturePanelProps['model'],
  feature: Record<string, unknown>,
  depth = 0,
) {
  const pm = new PluginManager([])
  ScoreFeaturePanelF(pm)
  return pm.evaluateExtensionPoint('Core-extraFeaturePanel', [], {
    model,
    feature: {
      uniqueId: 'f1',
      refName: 'ctgA',
      start: 0,
      end: 10,
      ...feature,
    },
    depth,
  })
}

const featureTrack = { trackType: 'FeatureTrack' }

test('contributes a panel for a scored feature on a FeatureTrack', () => {
  expect(panelsFor(featureTrack, { score: 42 })).toHaveLength(1)
})

test('contributes nothing on a subfeature card', () => {
  expect(panelsFor(featureTrack, { score: 42 }, 1)).toHaveLength(0)
})

test('contributes nothing for a feature with no score', () => {
  expect(panelsFor(featureTrack, {})).toHaveLength(0)
})

test('contributes nothing on another track type', () => {
  expect(panelsFor({ trackType: 'VariantTrack' }, { score: 42 })).toHaveLength(
    0,
  )
})
