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

const VALUE = ['encoding', 'color', 'value']

test('displayDefaults shorthand color lands on the LinearBasicDisplay', () => {
  // the object form (displayDefaults: {...}) was expanded to the array form
  // during hydration; the color routed to the display that defines a `color` slot
  const conf = hydrateTrack('gff3tabix_genes_shorthand_color')
  expect(readConfObject(display(conf, 'LinearBasicDisplay'), VALUE)).toBe(
    '#6a3d9a',
  )
})

test('one track-wide color reaches every variant display', () => {
  const conf = hydrateTrack('volvox_filtered_vcf_shorthand')
  // the multi-sample displays' cell color is a color object too, so a
  // track-wide color paints their alt cells
  for (const type of [
    'LinearVariantDisplay',
    'ChordVariantDisplay',
    'LinearMultiSampleVariantDisplay',
  ]) {
    expect(readConfObject(display(conf, type), VALUE)).toBe('#1f78b4')
  }
})

function hydrate(type: string, displayDefaults: Record<string, unknown>) {
  const pluginManager = makePluginManager()
  return pluginManager.getTrackType(type).configSchema.create(
    {
      trackId: 'routed',
      type,
      assemblyNames: ['volvox'],
      adapter:
        type === 'VariantTrack'
          ? { type: 'VcfAdapter', uri: 'volvox.filtered.vcf' }
          : { type: 'Gff3Adapter', uri: 'volvox.gff3' },
      displayDefaults,
    },
    { pluginManager },
  ) as AnyConfigurationModel & { displays: AnyConfigurationModel[] }
}

function colorOf(conf: { displays: AnyConfigurationModel[] }, type: string) {
  return getSnapshot(display(conf, type).encoding.color)
}

// Every variant display reads a field of its color, so one track-wide setting
// colors the single-variant marks, the genotype cells and the chords alike.
test('a variant color field reaches every variant display', () => {
  const conf = hydrate('VariantTrack', {
    encoding: { color: { field: 'svType' } },
  })
  for (const type of [
    'LinearVariantDisplay',
    'LinearMultiSampleVariantDisplay',
    'ChordVariantDisplay',
  ]) {
    expect(colorOf(conf, type)).toEqual({ field: 'svType' })
  }
})

// `r2` is a field the GWAS adapter joins, so `{ field: 'r2' }` is a field
// like any other to the routing and reaches the feature display, where it
// paints a field the features lack (ADR-135).
test.each(['type', 'r2'])(
  'a color field %s reaches the displays whose color is an object',
  field => {
    const conf = hydrate('FeatureTrack', { encoding: { color: { field } } })
    expect(colorOf(conf, 'LinearBasicDisplay')).toEqual({ field })
  },
)

test('the flat scale string inside the channel fails the load, naming the object to write', () => {
  expect(() =>
    hydrate('FeatureTrack', { encoding: { color: { scale: 'ordinal' } } }),
  ).toThrow('write encoding.color.scale: { "type": "ordinal" }')
})
