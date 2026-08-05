import PluginManager from './PluginManager.ts'
import { addExtensionElement } from './ui/addExtensionElement.tsx'
import { addFeaturePanel } from './ui/addFeaturePanel.ts'

import type { FeaturePanelProps } from './PluginManager.ts'

// Accumulating points hand a contributor only the props, so the array of
// everyone else's entries is never in reach. These assert the property that
// buys: no registration order and no return shape can lose another plugin's
// contribution.
const A = () => null
const B = () => null

function fireFeaturePanels(
  pm: PluginManager,
  model: FeaturePanelProps['model'],
) {
  return pm.evaluateExtensionPoint('Core-extraFeaturePanel', [], {
    model,
    feature: { uniqueId: 'f1', refName: 'ctgA', start: 0, end: 10 },
    depth: 0,
  })
}

test('contributions from two plugins accumulate in registration order', () => {
  const pm = new PluginManager([])
  pm.contributeToExtensionPoint('Core-extraFeaturePanel', () => A)
  pm.contributeToExtensionPoint('Core-extraFeaturePanel', () => B)
  expect(fireFeaturePanels(pm, {})).toEqual([A, B])
})

test('a contributor returning undefined adds nothing and drops nothing', () => {
  const pm = new PluginManager([])
  pm.contributeToExtensionPoint('Core-extraFeaturePanel', () => A)
  pm.contributeToExtensionPoint('Core-extraFeaturePanel', () => undefined)
  pm.contributeToExtensionPoint('Core-extraFeaturePanel', () => B)
  expect(fireFeaturePanels(pm, {})).toEqual([A, B])
})

test('a contributor can return several entries at once', () => {
  const pm = new PluginManager([])
  pm.contributeToExtensionPoint('Core-extraFeaturePanel', () => [A, B])
  expect(fireFeaturePanels(pm, {})).toEqual([A, B])
})

test('entries the producer seeds the point with survive every contributor', () => {
  const pm = new PluginManager([])
  pm.contributeToExtensionPoint('Core-extraFeaturePanel', () => B)
  expect(
    pm.evaluateExtensionPoint('Core-extraFeaturePanel', [A], {
      model: {},
      feature: { uniqueId: 'f1', refName: 'ctgA', start: 0, end: 10 },
      depth: 0,
    }),
  ).toEqual([A, B])
})

test('a contributor is handed the props and nothing else', () => {
  const pm = new PluginManager([])
  pm.contributeToExtensionPoint('Core-extraFeaturePanel', () => A)
  const contribute = jest.fn((_props: FeaturePanelProps) => B)
  pm.contributeToExtensionPoint('Core-extraFeaturePanel', contribute)
  fireFeaturePanels(pm, { trackId: 't1' })
  expect(contribute.mock.calls[0]![0]).toMatchObject({
    depth: 0,
    model: { trackId: 't1' },
  })
  // the guarantee, stated as arity: no second argument carries [A], so there is
  // nothing for this callback to drop
  expect(contribute.mock.calls[0]).toHaveLength(1)
})

test('addFeaturePanel scopes without touching other plugins entries', () => {
  const pm = new PluginManager([])
  addFeaturePanel(pm, { panel: A })
  addFeaturePanel(pm, { select: { trackType: 'VariantTrack' }, panel: B })
  expect(fireFeaturePanels(pm, { trackType: 'VariantTrack' })).toEqual([A, B])
  expect(fireFeaturePanels(pm, { trackType: 'AlignmentsTrack' })).toEqual([A])
})

test('addExtensionElement contributes one keyed element per registration', () => {
  const pm = new PluginManager([])
  addExtensionElement(pm, 'LinearGenomeView-TracksContainerComponent', A)
  addExtensionElement(pm, 'LinearGenomeView-TracksContainerComponent', B)
  const nodes = pm.evaluateExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    [],
    // the point's props; the elements only need to be constructed, not rendered
    {} as never,
  )
  expect(nodes).toHaveLength(2)
  expect(new Set(nodes.map(n => (n as { key: string }).key)).size).toBe(2)
})
