import { readConfObject } from '@jbrowse/core/configuration'
import {
  createTestSession,
  createTestSessionAsync,
} from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from './model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// volvox.paf has no fixture: served as an empty file, a valid PAF with no rows.
// all.paf is PanSN, one alignment per adjacent pair of the three genomes.
const pansn = (q: string, t: string) =>
  `${q}#0#ctgA\t16000\t0\t100\t+\t${t}#0#ctgA\t16000\t0\t100\t100\t100\t60`
beforeEach(() => {
  fetchMock.mockResponse(req =>
    Promise.resolve(
      req.url.endsWith('all.paf')
        ? [pansn('volvox', 'volvox2'), pansn('volvox2', 'volvox3')].join('\n')
        : '',
    ),
  )
})

const assembly = (name: string) => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: `${name}-ctgA`,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        },
      ],
    },
  },
})

const pafTrack = (trackId: string, assemblyNames: string[]) => ({
  type: 'SyntenyTrack',
  trackId,
  name: trackId,
  assemblyNames,
  adapter: {
    type: 'PAFAdapter',
    pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
    queryAssembly: assemblyNames[0],
    targetAssembly: assemblyNames[1],
  },
})

function setup() {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox'))
  session.addAssemblyConf(assembly('volvox2'))
  session.addAssemblyConf(assembly('volvox3'))
  session.addSessionTrackConf(pafTrack('vol_synteny', ['volvox', 'volvox2']))
  session.addSessionTrackConf(pafTrack('vol_2_3', ['volvox3', 'volvox2']))
  session.addSessionTrackConf(pafTrack('vol_1_3', ['volvox', 'volvox3']))
  session.addSessionTrackConf({
    type: 'SyntenyTrack',
    trackId: 'vol_all',
    name: 'vol all',
    assemblyNames: ['volvox', 'volvox2', 'volvox3'],
    adapter: {
      type: 'MultiGenomePAFAdapter',
      pafLocation: { uri: 'all.paf', locationType: 'UriLocation' },
      assemblyNames: ['volvox', 'volvox2', 'volvox3'],
    },
  })
  return { session }
}

const views = [{ assembly: 'volvox' }, { assembly: 'volvox2' }]

async function openWith(spec: Record<string, unknown>) {
  return (await openIn(spec)).view
}

async function openIn(spec: Record<string, unknown>) {
  const { session } = setup()
  const view = (await session.launchView(
    'LinearSyntenyView',
    spec,
  )) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(
    () => view.views.length > 0 && view.views.every(v => v.initialized),
  )
  // levels are reconciled from the view pairs; give the launch pass its microtasks
  await when(() => view.levels.length > 0)
  return { session, view }
}

// a level's `tracks` is a pluggableMstType array, so its element type is loose;
// naming the one member this reads keeps it checked without a cast
const openTrackIds = (view: LinearSyntenyViewModel) =>
  view.levels.flatMap(l =>
    (l.tracks as { configuration: AnyConfigurationModel }[]).map(
      t => readConfObject(t.configuration, 'trackId') as string,
    ),
  )

const levelTrackIds = (view: LinearSyntenyViewModel) =>
  view.levels.map(l =>
    (l.tracks as { configuration: AnyConfigurationModel }[]).map(
      t => readConfObject(t.configuration, 'trackId') as string,
    ),
  )

const threeRows = [
  { assembly: 'volvox' },
  { assembly: 'volvox2' },
  { assembly: 'volvox3' },
]

test('a flat `tracks` opens the synteny track on level 0', async () => {
  const view = await openWith({ views, tracks: ['vol_synteny'] })
  await when(() => openTrackIds(view).length > 0, { timeout: 5000 })
  expect(openTrackIds(view)).toEqual(['vol_synteny'])
})

test('a per-level `tracks` opens the synteny track on level 0', async () => {
  const view = await openWith({ views, tracks: [['vol_synteny']] })
  await when(() => openTrackIds(view).length > 0, { timeout: 5000 })
  expect(openTrackIds(view)).toEqual(['vol_synteny'])
})

test('a flat `tracks` puts a multi-genome track on every band', async () => {
  const view = await openWith({ views: threeRows, tracks: ['vol_all'] })
  await when(() => openTrackIds(view).length === 2, { timeout: 5000 })
  expect(levelTrackIds(view)).toEqual([['vol_all'], ['vol_all']])
})

test('a flat `tracks` puts each pairwise track on its own band', async () => {
  const view = await openWith({
    views: threeRows,
    tracks: ['vol_2_3', 'vol_synteny'],
  })
  await when(() => openTrackIds(view).length === 2, { timeout: 5000 })
  expect(levelTrackIds(view)).toEqual([['vol_synteny'], ['vol_2_3']])
})

test('a flat entry covering no band is reported, and the view still settles', async () => {
  const { session, view } = await openIn({
    views: threeRows,
    tracks: ['vol_synteny', 'vol_1_3', 'vol_2_3'],
    levelHeights: [123, 45],
  })
  await when(() => view.levels[1]?.height === 45, { timeout: 5000 })
  expect(levelTrackIds(view)).toEqual([['vol_synteny'], ['vol_2_3']])
  expect(session.snackbarMessages.map(m => m.message)).toEqual([
    expect.stringContaining('"vol_1_3" (volvox, volvox3) covers no adjacent'),
  ])
})

test('an unknown trackId is reported, and the view still settles', async () => {
  const { session, view } = await openIn({
    views: threeRows,
    tracks: ['nope', 'vol_all'],
    levelHeights: [123, 45],
  })
  await when(() => view.levels[1]?.height === 45, { timeout: 5000 })
  expect(levelTrackIds(view)).toEqual([['vol_all'], ['vol_all']])
  expect(session.snackbarMessages.map(m => m.message)).toEqual([
    expect.stringContaining('Could not resolve identifier "nope"'),
  ])
})

// A session written before levels held their tracks lists the built tracks on
// the view itself, which v4.3.0 opened on level 0 and the demo configs still
// write.
test('built tracks on the view open on level 0', async () => {
  const row = (id: string, assemblyName: string) => ({
    id,
    type: 'LinearGenomeView',
    bpPerPx: 10,
    offsetPx: 0,
    displayedRegions: [
      { assemblyName, refName: 'ctgA', start: 0, end: 16000, reversed: false },
    ],
  })
  const session = await createTestSessionAsync({
    jbrowseConfig: {
      assemblies: [assembly('volvox'), assembly('volvox2')],
      tracks: [
        {
          type: 'SyntenyTrack',
          trackId: 'vol_synteny',
          name: 'vol synteny',
          assemblyNames: ['volvox', 'volvox2'],
          adapter: {
            type: 'PAFAdapter',
            pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
            queryAssembly: 'volvox',
            targetAssembly: 'volvox2',
          },
        },
      ],
    },
    sessionSnapshot: {
      views: [
        {
          type: 'LinearSyntenyView',
          views: [row('r1', 'volvox'), row('r2', 'volvox2')],
          tracks: [
            {
              type: 'SyntenyTrack',
              configuration: 'vol_synteny',
              displays: [
                {
                  type: 'LinearSyntenyDisplay',
                  configuration: 'vol_synteny-LinearSyntenyDisplay',
                },
              ],
            },
          ],
        },
      ],
    },
  })
  expect(openTrackIds(session.views[0] as LinearSyntenyViewModel)).toEqual([
    'vol_synteny',
  ])
})
