import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import configSnapshot from '../../test_data/volvox/config.json' with { type: 'json' }
import corePlugins from '../corePlugins.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// Exercises the `displayDefaults: {...}` track-config shorthand
// (expandTrackConfigShorthand) end to end with the full set of jbrowse-web
// plugins, using the example tracks in test_data/volvox/config.json. Confirms
// settings route to the right display configs by slot name after
// preProcessSnapshot runs during hydration.
function makePluginManager() {
  return new PluginManager(corePlugins.map(P => new P()))
    .createPluggableElements()
    .configure()
}

function hydrateTrack(trackId: string) {
  const pluginManager = makePluginManager()
  const snap = configSnapshot.tracks.find(t => t.trackId === trackId)
  if (!snap) {
    throw new Error(`track ${trackId} not found in volvox config`)
  }
  const { configSchema } = pluginManager.getTrackType(snap.type)
  return configSchema.create(snap, {
    pluginManager,
  }) as AnyConfigurationModel & {
    displays: AnyConfigurationModel[]
  }
}

function display(conf: { displays: AnyConfigurationModel[] }, type: string) {
  const found = conf.displays.find(d => readConfObject(d, 'type') === type)
  if (!found) {
    throw new Error(`display ${type} not found`)
  }
  return found
}

test('displayDefaults shorthand color lands on the LinearBasicDisplay', () => {
  // the object form (displayDefaults: {...}) was expanded to the array form
  // during hydration; the color routed to the display that defines a `color` slot
  const conf = hydrateTrack('gff3tabix_genes_shorthand_color')
  expect(
    readConfObject(display(conf, 'LinearBasicDisplay'), ['color', 'value']),
  ).toBe('#6a3d9a')
})

test('display settings route by slot name across a track’s displays', () => {
  const conf = hydrateTrack('volvox_filtered_vcf_shorthand')
  expect(
    readConfObject(display(conf, 'LinearVariantDisplay'), ['color', 'value']),
  ).toBe('#1f78b4')
  expect(
    readConfObject(display(conf, 'ChordVariantDisplay'), 'strokeColor'),
  ).toBe('#e31a1c')
})

// A FeatureTrack offers five displays, three of which declare `color` in
// different shapes: the feature display's field-or-constant object, the
// Manhattan display's object with a scale, and the arc and multi-row
// displays' plain colour. A value goes to the displays that take it.
function hydrateFeatureTrack(displayDefaults: Record<string, unknown>) {
  const pluginManager = makePluginManager()
  return pluginManager.getTrackType('FeatureTrack').configSchema.create(
    {
      trackId: 'routed',
      type: 'FeatureTrack',
      assemblyNames: ['volvox'],
      adapter: { type: 'Gff3Adapter', uri: 'volvox.gff3' },
      displayDefaults,
    },
    { pluginManager },
  ) as AnyConfigurationModel & { displays: AnyConfigurationModel[] }
}

function colorOf(conf: { displays: AnyConfigurationModel[] }, type: string) {
  return getSnapshot(display(conf, type).color)
}

test('a colour with a scale reaches only the display whose colour has one', () => {
  const conf = hydrateFeatureTrack({ color: { scale: 'ld' } })
  expect(colorOf(conf, 'LinearManhattanDisplay')).toEqual({ scale: 'ld' })
  expect(colorOf(conf, 'LinearBasicDisplay')).toEqual({})
})

test('a colour field reaches the displays whose colour is an object', () => {
  const conf = hydrateFeatureTrack({ color: { field: 'type' } })
  expect(colorOf(conf, 'LinearManhattanDisplay')).toEqual({ field: 'type' })
  expect(colorOf(conf, 'LinearBasicDisplay')).toEqual({ field: 'type' })
})

test('a colour no display takes fails the load, naming every reason', () => {
  expect(() => hydrateFeatureTrack({ color: { scale: 'linear' } })).toThrow(
    /no display of a FeatureTrack takes displayDefaults\.color \(LinearBasicDisplay: .*LinearManhattanDisplay: /,
  )
})
