import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { CircularViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function assemblyConf(name: string, contigs: string[]) {
  return {
    name,
    sequence: {
      trackId: `${name}_refseq`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: contigs.map(refName => ({
          refName,
          uniqueId: `${name}-${refName}`,
          start: 0,
          end: 1000,
          seq: 'a'.repeat(1000),
        })),
      },
    },
  }
}

// a ring on genome A, chords on genome B, and the alignment between them
test('a linear view of each genome takes that genome’s rings and chord tracks', async () => {
  const session = createTestSession() as any
  session.addAssemblyConf(assemblyConf('A', ['a1']))
  session.addAssemblyConf(assemblyConf('B', ['b1']))
  session.addSessionTrackConf({
    trackId: 'aln',
    type: 'SyntenyTrack',
    assemblyNames: ['B', 'A'],
    adapter: {
      type: 'PAFAdapter',
      pafLocation: {
        localPath: require.resolve('./test_data/mirror.paf'),
        locationType: 'LocalPathLocation',
      },
      queryAssembly: 'B',
      targetAssembly: 'A',
    },
  })
  session.addSessionTrackConf({
    trackId: 'genesA',
    type: 'FeatureTrack',
    assemblyNames: ['A'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  session.addSessionTrackConf({
    trackId: 'svB',
    type: 'VariantTrack',
    assemblyNames: ['B'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  const view = (await session.launchView('CircularView', {
    assembly: ['A', 'B'],
    tracks: ['aln', 'genesA', 'svB'],
  })) as CircularViewModel
  view.setWidth(800)
  await when(() => view.tracks.length === 3, { timeout: 30000 })

  const ring = view.tracks.find(t => t.configuration.trackId === 'genesA')!
    .displays[0]!
  expect(view.linearTracksFor('A')).toEqual([
    { trackId: 'genesA', type: ring.type },
  ])
  expect(view.linearTracksFor('B')).toEqual([{ trackId: 'svB' }])
}, 40000)
