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
    init: { assembly: 'volvox', loc: 'ctgA:1..1000', tracks: ['loose_bam'] },
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
