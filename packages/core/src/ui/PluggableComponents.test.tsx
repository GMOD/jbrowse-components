import { render } from '@testing-library/react'

import PluginManager from '../PluginManager.ts'
import PluggableComponents from './PluggableComponents.tsx'

import type { FeaturePanelProps } from '../PluginManager.ts'

const props: FeaturePanelProps = {
  model: { trackId: 't1', trackType: 'VariantTrack' },
  feature: { uniqueId: 'f1', refName: 'ctgA', start: 0, end: 10 },
  depth: 0,
}

function renderPanels(pm: PluginManager) {
  return render(
    <PluggableComponents
      pluginManager={pm}
      name="Core-extraFeaturePanel"
      props={props}
    />,
  ).container.textContent
}

const A = () => <div>a</div>
const B = () => <div>b</div>

test('renders every contributed panel in registration order', () => {
  const pm = new PluginManager([])
  pm.contributeToExtensionPoint('Core-extraFeaturePanel', () => A)
  pm.contributeToExtensionPoint('Core-extraFeaturePanel', () => B)
  expect(renderPanels(pm)).toBe('ab')
})

test('renders nothing when nobody contributed', () => {
  expect(renderPanels(new PluginManager([]))).toBe('')
})

test('each panel is handed the points props', () => {
  const pm = new PluginManager([])
  pm.contributeToExtensionPoint(
    'Core-extraFeaturePanel',
    () =>
      function Panel(p: FeaturePanelProps) {
        return <div>{`${p.model.trackId}@${p.depth}`}</div>
      },
  )
  expect(renderPanels(pm)).toBe('t1@0')
})

// pre-v5 callbacks returned one component rather than appending to an array,
// and the two producers that used to hand-roll this loop normalized it
// differently — one of them not at all
test('a callback that returns a bare component still renders', () => {
  const pm = new PluginManager([])
  // @ts-expect-error the pre-v5 shape, kept working for plugins in the wild
  pm.addToExtensionPoint('Core-extraFeaturePanel', () => A)
  expect(renderPanels(pm)).toBe('a')
})
