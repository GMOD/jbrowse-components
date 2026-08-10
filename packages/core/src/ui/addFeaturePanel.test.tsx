import PluginManager from '../PluginManager.ts'
import { addFeaturePanel } from './addFeaturePanel.ts'

import type { FeaturePanelProps } from '../PluginManager.ts'

const Panel = () => null
const Other = () => null

function fire(
  pm: PluginManager,
  model: Partial<FeaturePanelProps['model']>,
  depth = 0,
) {
  return pm.evaluateExtensionPoint('Core-extraFeaturePanel', [], {
    model,
    feature: { uniqueId: 'f1', refName: 'ctgA', start: 0, end: 10 },
    depth,
  })
}

test('a selector scopes a panel to one track type', () => {
  const pm = new PluginManager([])
  addFeaturePanel(pm, { select: { trackType: 'VariantTrack' }, panel: Panel })
  expect(fire(pm, { trackType: 'VariantTrack' })).toEqual([Panel])
  expect(fire(pm, { trackType: 'AlignmentsTrack' })).toEqual([])
})

test('panels from two plugins both appear, in registration order', () => {
  const pm = new PluginManager([])
  addFeaturePanel(pm, { panel: Panel })
  addFeaturePanel(pm, { panel: Other })
  expect(fire(pm, {})).toEqual([Panel, Other])
})

test('a bare trackId matches the track and its copies but not a lookalike', () => {
  const pm = new PluginManager([])
  addFeaturePanel(pm, { select: { trackId: 'volvox.inv.vcf' }, panel: Panel })
  expect(fire(pm, { trackId: 'volvox.inv.vcf' })).toEqual([Panel])
  expect(fire(pm, { trackId: 'volvox.inv.vcf-1712000000000' })).toEqual([Panel])
  expect(fire(pm, { trackId: 'volvox.inv.vcf-extra' })).toEqual([])
})

test('every field of a selector must match', () => {
  const pm = new PluginManager([])
  addFeaturePanel(pm, {
    select: { trackType: 'VariantTrack', trackId: 'a' },
    panel: Panel,
  })
  expect(fire(pm, { trackType: 'VariantTrack', trackId: 'a' })).toEqual([Panel])
  expect(fire(pm, { trackType: 'VariantTrack', trackId: 'b' })).toEqual([])
})

// `where` gets the feature too, which the declarative fields cannot reach
test('where can scope on the feature being shown', () => {
  const pm = new PluginManager([])
  addFeaturePanel(pm, {
    select: { where: ({ feature }) => feature.type === 'gene' },
    panel: Panel,
  })
  expect(fire(pm, {})).toEqual([])
  expect(
    pm.evaluateExtensionPoint('Core-extraFeaturePanel', [], {
      model: {},
      feature: {
        uniqueId: 'f1',
        refName: 'ctgA',
        start: 0,
        end: 10,
        type: 'gene',
      },
      depth: 0,
    }),
  ).toEqual([Panel])
})

// the point fires for every subfeature card too, so this is how a panel says
// "only on the feature the user actually clicked"
test('where can scope to the top-level card by depth', () => {
  const pm = new PluginManager([])
  addFeaturePanel(pm, {
    select: { where: ({ depth }) => depth === 0 },
    panel: Panel,
  })
  expect(fire(pm, {}, 0)).toEqual([Panel])
  expect(fire(pm, {}, 1)).toEqual([])
})

test('an empty selector adds the panel everywhere', () => {
  const pm = new PluginManager([])
  addFeaturePanel(pm, { panel: Panel })
  expect(fire(pm, { trackType: 'AnythingTrack' })).toEqual([Panel])
})
