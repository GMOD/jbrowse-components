import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'

import corePlugins from '../corePlugins.ts'
import configSnapshot from '../../test_data/volvox/config.json' with { type: 'json' }

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// Exercises the track-config display shorthand (expandTrackConfigShorthand) end
// to end with the full set of jbrowse-web plugins, using the example tracks in
// test_data/volvox/config.json. Confirms top-level/per-view settings land on the
// right display configs after preProcessSnapshot runs during hydration.
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
  return configSchema.create(snap, { pluginManager }) as AnyConfigurationModel & {
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

test('flat top-level color lands on the LinearBasicDisplay', () => {
  const conf = hydrateTrack('gff3tabix_genes_shorthand_color')
  expect(readConfObject(display(conf, 'LinearBasicDisplay'), 'color')).toBe(
    '#6a3d9a',
  )
  // shorthand key is consumed, not left at the track top level
  expect(conf).not.toHaveProperty('color')
})

test('per-view shorthand lands on each view-specific display', () => {
  const conf = hydrateTrack('volvox_filtered_vcf_shorthand')
  expect(readConfObject(display(conf, 'LinearVariantDisplay'), 'color')).toBe(
    '#1f78b4',
  )
  expect(
    readConfObject(display(conf, 'ChordVariantDisplay'), 'strokeColor'),
  ).toBe('#e31a1c')
})
