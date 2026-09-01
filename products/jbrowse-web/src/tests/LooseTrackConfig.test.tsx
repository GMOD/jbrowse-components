import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import configSnapshot from '../../test_data/volvox/config.json' with { type: 'json' }
import { utilizeFetchMockForTest, volvoxGetFile } from './generateReadBuffer.ts'
import { getPluginManager } from './util.tsx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

jest.mock('../makeWorkerInstance', () => () => {})

utilizeFetchMockForTest(volvoxGetFile)

// One assembly, so a loose track need not name it
const config = {
  assemblies: [configSnapshot.assemblies[0]],
  tracks: [{ trackId: 'loose_bam', uri: 'volvox-sorted.bam' }],
}

test('a config track written as { trackId, uri } opens as an alignments track on the one assembly', async () => {
  const { rootModel } = getPluginManager(config)
  const session = rootModel.session!
  expect(session.getTrackById('loose_bam')).toMatchObject({
    type: 'AlignmentsTrack',
    name: 'volvox-sorted.bam',
    assemblyNames: ['volvox'],
    adapter: { type: 'BamAdapter' },
  })
  const view = session.addView('LinearGenomeView', {
    assembly: 'volvox',
    loc: 'ctgA:1..1000',
    tracks: ['loose_bam'],
  }) as LinearGenomeViewModel
  view.setWidth(800)
  await waitFor(
    () => {
      expect(view.tracks).toHaveLength(1)
    },
    { timeout: 30000 },
  )
  const display = view.tracks[0]!.displays[0]!
  expect(display.type).toBe('LinearAlignmentsDisplay')
  // the track the assertions are about starts a real render, and a test that
  // returns while it is in flight resolves its lazy RPC import after the jest
  // environment has gone
  await waitFor(
    () => {
      expect(display.isLoading).toBe(false)
    },
    { timeout: 30000 },
  )
}, 40000)

test('a loose track added to the config or the session expands the same way', () => {
  const { rootModel } = getPluginManager(config, false)
  const session = rootModel.session!
  const sessionTrack = session.addTrackConf({
    trackId: 'loose_vcf',
    uri: 'volvox.filtered.vcf.gz',
    assemblyNames: ['volvox'],
  })
  expect(getSnapshot(sessionTrack)).toMatchObject({
    type: 'VariantTrack',
    adapter: { type: 'VcfTabixAdapter' },
  })
  expect(
    rootModel.jbrowse.addTrackConf({
      trackId: 'loose_gff',
      uri: 'volvox.sort.gff3.gz',
      name: 'Genes',
    }),
  ).toMatchObject({
    type: 'FeatureTrack',
    name: 'Genes',
    adapter: { type: 'Gff3TabixAdapter' },
  })
})

// The fourth entry point, and the one `pluggableConfigSchemaType('track')`'s
// loose preprocessor does not cover: `showTrack`'s `inlineConf` writes the
// config into the track itself (ADR-084), through the concrete track type's
// `ConfigurationReference`, not through the union that carries the preprocessor.
// `showTrackGeneric` expanded the loose form only to validate it and to pick
// the display, then stored the caller's unexpanded object — so the whole
// showTrack failed with `Unknown track type "undefined"` in a snackbar.
test('a loose config passed to showTrack as an inline conf expands too', () => {
  const { rootModel } = getPluginManager(config)
  const session = rootModel.session!
  const view = session.addView('LinearGenomeView', {
    assembly: 'volvox',
    loc: 'ctgA:1..1000',
  }) as LinearGenomeViewModel
  const track = view.showTrack(
    'loose_inline',
    {},
    {},
    {
      trackId: 'loose_inline',
      uri: 'volvox.filtered.vcf.gz',
      assemblyNames: ['volvox'],
    },
  )

  expect(session.snackbarMessages).toEqual([])
  expect(track).toBeDefined()
  expect(getSnapshot(track!.configuration)).toMatchObject({
    type: 'VariantTrack',
    trackId: 'loose_inline',
    adapter: { type: 'VcfTabixAdapter' },
  })
  // and it is the track's own config, resolvable by nothing else (ADR-084)
  expect(session.getTrackById('loose_inline')).toBeUndefined()
})
