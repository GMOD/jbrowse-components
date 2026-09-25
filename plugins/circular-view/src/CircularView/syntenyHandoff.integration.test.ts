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
function sessionWithTracks() {
  const session = createTestSession() as any
  session.addAssemblyConf(assemblyConf('A', ['a1', 'a2']))
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
  return session
}

async function circle(session: any, spec: Record<string, unknown>) {
  const view = (await session.launchView('CircularView', {
    assembly: ['A', 'B'],
    ...spec,
  })) as CircularViewModel
  view.setWidth(800)
  await when(() => view.pendingLaunch === undefined, { timeout: 30000 })
  return view
}

function viewOfType(session: any, type: string) {
  return when(() => session.views.some((v: any) => v.type === type), {
    timeout: 30000,
  }).then(() => session.views.find((v: any) => v.type === type))
}

test('a linear view of each genome takes that genome’s rings and chord tracks', async () => {
  const session = sessionWithTracks()
  const view = await circle(session, { tracks: ['aln', 'genesA', 'svB'] })
  await when(() => view.tracks.length === 3, { timeout: 30000 })

  const ring = view.tracks.find(t => t.configuration.trackId === 'genesA')!
    .displays[0]!
  expect(view.linearTracksFor('A')).toEqual([
    { trackId: 'genesA', type: ring.type },
  ])
  expect(view.linearTracksFor('B')).toEqual([{ trackId: 'svB' }])
}, 40000)

// the linear view opens on the chromosomes the circle shows, each row with
// its genome's tracks, the ribbons between them, in the circle's colour; and
// back again
test('the circle and the linear synteny view open each other with their colour', async () => {
  const session = sessionWithTracks()
  const view = await circle(session, {
    displayedRegionNames: { A: ['a1'] },
    tracks: ['aln', 'genesA'],
    color: { field: 'query' },
    minAlignmentLength: 50,
  })
  view.openInLinearSyntenyView()
  const linear = await viewOfType(session, 'LinearSyntenyView')
  linear.setWidth(800)
  await when(() => linear.views.length === 2 && !linear.pendingLaunch, {
    timeout: 30000,
  })
  expect(linear.views.map((v: any) => v.assemblyNames[0])).toEqual(['A', 'B'])
  expect(linear.views[0].displayedRegions.map((r: any) => r.refName)).toEqual([
    'a1',
  ])
  await when(() => linear.views[0].tracks.length > 0, { timeout: 30000 })
  expect(
    linear.views[0].tracks.map((t: any) => t.configuration.trackId),
  ).toEqual(['genesA'])
  expect(
    linear.levels[0].tracks.map((t: any) => t.configuration.trackId),
  ).toEqual(['aln'])
  expect(linear.colorField).toBe('query')
  expect(linear.minAlignmentLength).toBe(50)

  linear.setColorField('strand')
  linear.openInCircularSyntenyView()
  await when(() => session.views.length === 3, { timeout: 30000 })
  const back = session.views[2] as CircularViewModel
  back.setWidth(800)
  await when(() => back.pendingLaunch === undefined, { timeout: 30000 })
  expect(back.assemblyNames).toEqual(['A', 'B'])
  expect(back.tracks.map(t => t.configuration.trackId)).toEqual(['aln'])
  expect(back.colorField).toBe('strand')
}, 60000)

test('the dotplot opens a circle of its two genomes with its colour', async () => {
  const session = sessionWithTracks()
  const dotplot = await session.launchView('DotplotView', {
    views: [{ assembly: 'A' }, { assembly: 'B' }],
    tracks: ['aln'],
    color: { field: 'target' },
  })
  dotplot.setWidth(800)
  await when(() => dotplot.assemblyNames.length === 2, { timeout: 30000 })
  dotplot.openInCircularSyntenyView()
  const view = (await viewOfType(session, 'CircularView')) as CircularViewModel
  view.setWidth(800)
  await when(() => view.pendingLaunch === undefined, { timeout: 30000 })
  expect(view.assemblyNames).toEqual(['A', 'B'])
  expect(view.tracks.map(t => t.configuration.trackId)).toEqual(['aln'])
  expect(view.colorField).toBe('target')
}, 60000)
