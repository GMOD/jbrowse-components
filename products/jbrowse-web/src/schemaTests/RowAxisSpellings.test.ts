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
  'LinearMarkDisplay',
  'LinearManhattanDisplay',
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

function hydrate(
  type: string,
  adapter: Record<string, unknown>,
  displayDefaults: Record<string, unknown>,
) {
  return pluginManager.getTrackType(type).configSchema.create(
    {
      trackId: 'routed',
      type,
      assemblyNames: ['volvox'],
      adapter,
      displayDefaults,
    },
    { pluginManager },
  ) as AnyConfigurationModel & { displays: AnyConfigurationModel[] }
}

function axisOf(
  track: { displays: AnyConfigurationModel[] },
  type: string,
  member: string,
) {
  const display = track.displays.find(d => readConfObject(d, 'type') === type)
  if (!display) {
    throw new Error(`no ${type}`)
  }
  return readConfObject(display, ['axis', member])
}

test('a track-wide axis with grid still reaches the gridless mark display', () => {
  const track = hydrate(
    'QuantitativeTrack',
    { type: 'BigWigAdapter', uri: 'a.bw' },
    { axis: { tree: false, grid: true } },
  )
  expect(axisOf(track, 'LinearWiggleDisplay', 'tree')).toBe(false)
  expect(axisOf(track, 'LinearWiggleDisplay', 'grid')).toBe(true)
  expect(axisOf(track, 'LinearMarkDisplay', 'tree')).toBe(false)
})

test("a variant track's axis labels reach its mark display", () => {
  const track = hydrate(
    'VariantTrack',
    { type: 'VcfAdapter', uri: 'a.vcf' },
    { axis: { labels: false, grid: true } },
  )
  expect(axisOf(track, 'LinearMultiSampleVariantDisplay', 'labels')).toBe(false)
  expect(axisOf(track, 'LinearMultiSampleVariantDisplay', 'grid')).toBe(true)
  expect(axisOf(track, 'LinearMarkDisplay', 'labels')).toBe(false)
})

test('a MAF track takes the axis members it declares, and its mark display the grid', () => {
  const track = hydrate(
    'MafTrack',
    { type: 'MafTabixAdapter', uri: 'a.bed.gz' },
    { axis: { grid: true, tree: false } },
  )
  expect(axisOf(track, 'LinearMafDisplay', 'tree')).toBe(false)
  expect(axisOf(track, 'LinearMarkDisplay', 'grid')).toBe(true)
})
