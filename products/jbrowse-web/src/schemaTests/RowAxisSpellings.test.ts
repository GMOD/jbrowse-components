import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'

import corePlugins from '../corePlugins.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  .createPluggableElements()
  .configure()

const ROW_DISPLAYS = [
  'LinearWiggleDisplay',
  'LinearMafDisplay',
  'LinearMarkDisplay',
  'LinearManhattanDisplay',
  'LinearMultiSampleVariantDisplay',
  'LinearMultiRowFeatureDisplay',
]

const GRID_DISPLAYS = new Set([
  'LinearWiggleDisplay',
  'LinearMultiSampleVariantDisplay',
  'LinearMultiRowFeatureDisplay',
])

function create(type: string, snap: Record<string, unknown>) {
  return pluginManager
    .getDisplayType(type)
    .configSchema.create(
      { type, displayId: `${type}-d`, ...snap },
      { pluginManager },
    ) as AnyConfigurationModel
}

const RETIRED = {
  showTree: false,
  showBranchLength: false,
  showRowLabels: false,
  treeAreaWidth: 140,
}

test.each(ROW_DISPLAYS)('%s lifts the sidebar toggles onto axis', type => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const grid = GRID_DISPLAYS.has(type)
  const conf = create(type, {
    ...RETIRED,
    ...(grid ? { showRowSeparators: true } : {}),
  })
  expect(readConfObject(conf, ['axis', 'tree'])).toBe(false)
  expect(readConfObject(conf, ['axis', 'branchLength'])).toBe(false)
  expect(readConfObject(conf, ['axis', 'labels'])).toBe(false)
  expect(readConfObject(conf, ['axis', 'width'])).toBe(140)
  if (grid) {
    expect(readConfObject(conf, ['axis', 'grid'])).toBe(true)
  }
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
})

test('a track-wide old spelling reaches its display as axis', () => {
  const track = pluginManager.getTrackType('MafTrack').configSchema.create(
    {
      trackId: 'maf',
      type: 'MafTrack',
      assemblyNames: ['volvox'],
      adapter: { type: 'MafTabixAdapter', uri: 'a.bed.gz' },
      displayDefaults: { showTree: false },
    },
    { pluginManager },
  ) as AnyConfigurationModel & { displays: AnyConfigurationModel[] }
  expect(readConfObject(track.displays[0]!, ['axis', 'tree'])).toBe(false)
})
