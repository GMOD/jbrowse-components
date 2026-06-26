import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'

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
  expect(readConfObject(display(conf, 'LinearBasicDisplay'), 'color')).toBe(
    '#6a3d9a',
  )
})

test('display settings route by slot name across a track’s displays', () => {
  const conf = hydrateTrack('volvox_filtered_vcf_shorthand')
  expect(readConfObject(display(conf, 'LinearVariantDisplay'), 'color')).toBe(
    '#1f78b4',
  )
  expect(
    readConfObject(display(conf, 'ChordVariantDisplay'), 'strokeColor'),
  ).toBe('#e31a1c')
})
