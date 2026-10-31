import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'

import corePlugins from '../corePlugins.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  .createPluggableElements()
  .configure()

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
  expect(axisOf(track, 'LinearVariantDisplay', 'labels')).toBe(false)
  expect(axisOf(track, 'LinearVariantDisplay', 'grid')).toBe(true)
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
