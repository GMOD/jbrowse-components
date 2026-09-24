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
  // the multi-sample displays' cell colour is a colour object too, so a
  // track-wide colour paints their alt cells
  expect(
    readConfObject(display(conf, 'LinearMultiSampleVariantDisplay'), [
      'color',
      'value',
    ]),
  ).toBe('#1f78b4')
})

// Both variant displays read the impact preset as a field of their colour, so
// one track-wide setting colours the single-variant marks and the genotype
// cells alike.
test('a variant colour preset field reaches every variant display', () => {
  const pluginManager = makePluginManager()
  const conf = pluginManager.getTrackType('VariantTrack').configSchema.create(
    {
      trackId: 'routed_vcf',
      type: 'VariantTrack',
      assemblyNames: ['volvox'],
      adapter: { type: 'VcfAdapter', uri: 'volvox.filtered.vcf' },
      displayDefaults: { color: { field: 'impact' } },
    },
    { pluginManager },
  ) as AnyConfigurationModel & { displays: AnyConfigurationModel[] }
  for (const type of [
    'LinearVariantDisplay',
    'LinearMultiSampleVariantDisplay',
    'LinearMultiSampleVariantMatrixDisplay',
  ]) {
    expect(colorOf(conf, type)).toEqual({ field: 'impact' })
  }
})

// A FeatureTrack offers five displays, three of which declare `color` in
// different shapes: the feature and Manhattan displays' colour objects, and
// the arc and multi-row displays' plain colour. A value goes to the displays
// that take it.
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

// `ld` is a field the Manhattan display computes, so `{ field: 'ld' }` is a
// field like any other to the routing and reaches the feature display too,
// where it paints a field the features lack (ADR-135).
test.each(['type', 'ld'])(
  'a colour field %s reaches the displays whose colour is an object',
  field => {
    const conf = hydrateFeatureTrack({ color: { field } })
    expect(colorOf(conf, 'LinearManhattanDisplay')).toEqual({ field })
    expect(colorOf(conf, 'LinearBasicDisplay')).toEqual({ field })
  },
)

test('a dormant field under scale none reaches both colour objects as written', () => {
  const conf = hydrateFeatureTrack({ color: { field: 'type', scale: 'none' } })
  expect(colorOf(conf, 'LinearManhattanDisplay')).toEqual({
    field: 'type',
    scale: 'none',
  })
  expect(colorOf(conf, 'LinearBasicDisplay')).toEqual({
    field: 'type',
    scale: 'none',
  })
})

test('a colour no display takes fails the load, naming every reason', () => {
  expect(() => hydrateFeatureTrack({ color: { scale: 'linear' } })).toThrow(
    /no display of a FeatureTrack takes displayDefaults\.color \(LinearBasicDisplay: [\s\S]*LinearManhattanDisplay: /,
  )
})
