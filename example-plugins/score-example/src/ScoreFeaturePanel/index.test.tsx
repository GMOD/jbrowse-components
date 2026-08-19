import PluginManager from '@jbrowse/core/PluginManager'
import { render } from '@testing-library/react'

import ScoreFeaturePanelF from './index.tsx'

import type { FeaturePanelProps } from '@jbrowse/core/PluginManager'

// the panel scopes itself where it renders, not where it registers, so asking
// the extension point what it contributed says nothing about which tracks the
// user sees it on. Render what the widget would render
function scorePanelText(
  model: FeaturePanelProps['model'],
  feature: Record<string, unknown>,
  depth = 0,
) {
  const pm = new PluginManager([])
  ScoreFeaturePanelF(pm)
  const props = {
    model,
    feature: { uniqueId: 'f1', refName: 'ctgA', start: 0, end: 10, ...feature },
    depth,
  }
  const panels = pm.evaluateExtensionPoint('Core-extraFeaturePanel', [], props)
  expect(panels).toHaveLength(1)
  const Panel = panels[0]!
  return render(<Panel {...props} />).container.textContent
}

const featureTrack = { trackType: 'FeatureTrack' }

test('shows the score for a scored feature on a FeatureTrack', () => {
  expect(scorePanelText(featureTrack, { score: 42 })).toContain('42')
})

test('shows nothing on a subfeature card', () => {
  expect(scorePanelText(featureTrack, { score: 42 }, 1)).toBe('')
})

test('shows nothing for a feature with no score', () => {
  expect(scorePanelText(featureTrack, {})).toBe('')
})

test('shows nothing on another track type', () => {
  expect(scorePanelText({ trackType: 'VariantTrack' }, { score: 42 })).toBe('')
})
