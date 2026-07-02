import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'

import corePlugins from '../corePlugins.ts'
import { createTestSession } from '../rootModel/index.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

jest.mock('../makeWorkerInstance', () => () => {})

// Locks in the v4.1.1 "multi-sample variants colored by population" demo config
// so it keeps hydrating on this branch: the old `MultiLinearVariantDisplay` type
// string (renamed to LinearMultiSampleVariantDisplay), the adapter's
// `samplesTsvLocation` metadata slot, and the display's `colorBy` /
// `showReferenceAlleles` / `height` slots must all survive.
function makePluginManager() {
  return new PluginManager(corePlugins.map(P => new P()))
    .createPluggableElements()
    .configure()
}

function hydrate(snap: Record<string, unknown>) {
  const pluginManager = makePluginManager()
  const { configSchema } = pluginManager.getTrackType(snap.type as string)
  return configSchema.create(snap, {
    pluginManager,
  }) as AnyConfigurationModel & {
    displays: AnyConfigurationModel[]
    adapter: AnyConfigurationModel
  }
}

test('v4.1.1 multi-sample variant demo config still hydrates', () => {
  const conf = hydrate({
    type: 'VariantTrack',
    trackId: 'volvox multi-sample sv',
    name: 'volvox multi-sample sv',
    category: ['Variants'],
    adapter: {
      type: 'VcfTabixAdapter',
      uri: 'volvox.sv.vcf.gz',
      samplesTsvLocation: {
        uri: 'volvox.sv.samples.tsv',
        locationType: 'UriLocation',
      },
    },
    assemblyNames: ['volvox'],
    displays: [
      {
        // renamed display type; the DisplayType alias remaps it on hydrate
        type: 'MultiLinearVariantDisplay',
        showReferenceAlleles: true,
        colorBy: 'population',
        height: 800,
      },
    ],
  })

  // adapter metadata slot preserved
  const samplesTsv = readConfObject(conf.adapter, 'samplesTsvLocation')
  expect(samplesTsv.uri).toBe('volvox.sv.samples.tsv')

  // old display type was remapped to the canonical name
  const display = conf.displays.find(
    d => readConfObject(d, 'type') === 'LinearMultiSampleVariantDisplay',
  )
  if (!display) {
    throw new Error('LinearMultiSampleVariantDisplay not found after remap')
  }

  expect(readConfObject(display, 'colorBy')).toBe('population')
  expect(readConfObject(display, 'height')).toBe(800)
  // showReferenceAlleles: true seeds referenceDrawingMode: 'draw'
  expect(readConfObject(display, 'showReferenceAlleles')).toBe(true)
  expect(readConfObject(display, 'referenceDrawingMode')).toBe('draw')
})

// The track config path (above) resolves the old type via the DisplayType alias
// map. An *active display instance* in a stored session takes a different path:
// the track model's `displays` field is a bare `types.union` of display models
// with no dispatcher, so the old `MultiLinearVariantDisplay` type must be
// remapped by the model's own preProcessSnapshot for the union to resolve it.
// This exercises that session-restore path so old saved sessions keep loading.
test('old MultiLinearVariantDisplay instance resolves on session restore', () => {
  const session = createTestSession({
    jbrowseConfig: {
      assemblies: [
        {
          name: 'volvox',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'volvox_refseq',
            adapter: {
              type: 'FromConfigSequenceAdapter',
              features: [
                {
                  refName: 'ctgA',
                  uniqueId: 'firstId',
                  start: 0,
                  end: 100,
                  seq: 'A'.repeat(100),
                },
              ],
            },
          },
        },
      ],
      tracks: [
        {
          type: 'VariantTrack',
          trackId: 'cohort',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'VcfTabixAdapter',
            uri: 'volvox.sv.vcf.gz',
            samplesTsvLocation: { uri: 'volvox.sv.samples.tsv' },
          },
          displays: [
            {
              type: 'LinearMultiSampleVariantDisplay',
              displayId: 'cohort-LinearMultiSampleVariantDisplay',
              colorBy: 'population',
            },
          ],
        },
      ],
    },
    sessionSnapshot: {
      views: [
        {
          id: 'view1',
          type: 'LinearGenomeView',
          tracks: [
            {
              id: 'track1',
              type: 'VariantTrack',
              configuration: 'cohort',
              // old, pre-rename type string as an old saved session would store
              displays: [{ id: 'display1', type: 'MultiLinearVariantDisplay' }],
            },
          ],
        },
      ],
    },
  })

  const displays = session.views[0].tracks[0].displays
  expect(displays.length).toBe(1)
  expect(displays[0].type).toBe('LinearMultiSampleVariantDisplay')
})
