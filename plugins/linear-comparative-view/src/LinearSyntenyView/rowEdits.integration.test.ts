import { createTestSession } from '@jbrowse/web/testUtils'
import { waitFor } from '@testing-library/react'
import { when } from 'mobx'

import { removeRowMenuItems } from './menus.ts'

import type { LinearSyntenyViewModel } from './model.ts'

type WebSession = ReturnType<typeof createTestSession>

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

let openViews: { session: WebSession; view: LinearSyntenyViewModel }[] = []

afterEach(() => {
  for (const { session, view } of openViews) {
    session.removeView(view)
  }
  openViews = []
})

// no fixture file stands behind these adapters, so each shown track logs one
// fetch failure, and a fetch still in flight at teardown logs the other
const provoked = /Offset is outside the bounds|no session model found/
let reported: jest.SpyInstance
beforeAll(() => {
  const print = console.error
  reported = jest
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => {
      if (!provoked.test(args.map(a => `${a}`).join(' '))) {
        print(...args)
      }
    })
})
afterAll(() => {
  reported.mockRestore()
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

const syntenyTrack = (trackId: string, assemblyNames: string[]) => ({
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

const NAMES = ['asmA', 'asmB', 'asmC', 'asmD']

async function openStack(extraTracks: ReturnType<typeof syntenyTrack>[] = []) {
  const session = createTestSession()
  for (const name of NAMES) {
    session.addAssemblyConf(assembly(name))
  }
  const chain = NAMES.slice(0, -1).map((name, i) =>
    syntenyTrack(`${name}_${NAMES[i + 1]}`, [name, NAMES[i + 1]!]),
  )
  for (const conf of [...chain, ...extraTracks]) {
    session.addSessionTrackConf(conf)
  }
  const view = (await session.launchView('LinearSyntenyView', {
    views: NAMES.map(name => ({ assembly: name })),
    tracks: chain.map(conf => [conf.trackId]),
  })) as LinearSyntenyViewModel
  view.setWidth(800)
  openViews.push({ session, view })
  await when(() => view.views.length === 4 && view.initialized)
  await waitFor(() => {
    expect(bands(view)).toEqual([['asmA_asmB'], ['asmB_asmC'], ['asmC_asmD']])
  })
  return { session, view }
}

const rows = (view: LinearSyntenyViewModel) =>
  view.views.map(v => v.assemblyNames[0])

const bands = (view: LinearSyntenyViewModel) =>
  view.levels.map(l => l.tracks.map(t => t.configuration.trackId as string))

test('the top row goes with its band, and the bands below keep their tracks', async () => {
  const { view } = await openStack()
  const kept = view.levels.slice(1).map(l => l.id)

  view.removeRow(0)

  expect(rows(view)).toEqual(['asmB', 'asmC', 'asmD'])
  expect(bands(view)).toEqual([['asmB_asmC'], ['asmC_asmD']])
  expect(view.levels.map(l => l.id)).toEqual(kept)
  expect(view.levels.map(l => l.level)).toEqual([0, 1])
})

test('the bottom row goes with the band above it', async () => {
  const { view } = await openStack()

  view.removeRow(3)

  expect(rows(view)).toEqual(['asmA', 'asmB', 'asmC'])
  expect(bands(view)).toEqual([['asmA_asmB'], ['asmB_asmC']])
})

test('an interior row leaves an empty band where no track connects its neighbours', async () => {
  const { view } = await openStack()
  view.levels[1]!.setHeight(140)

  view.removeRow(2)

  expect(rows(view)).toEqual(['asmA', 'asmB', 'asmD'])
  expect(bands(view)).toEqual([['asmA_asmB'], []])
  expect(view.levels[1]!.height).toBe(140)
})

test('an interior row leaves its neighbours joined by a track that connects them', async () => {
  const { view } = await openStack([
    syntenyTrack('asmA_asmC', ['asmA', 'asmC']),
  ])

  view.removeRow(1)

  expect(rows(view)).toEqual(['asmA', 'asmC', 'asmD'])
  await waitFor(() => {
    expect(bands(view)).toEqual([['asmA_asmC'], ['asmC_asmD']])
  })
})

test('both anchors keep naming the row they named', async () => {
  const { view } = await openStack()
  view.setFollowAnchorIndex(2)
  view.setDiagonalizeAnchorRow(3)

  view.removeRow(0)
  expect(view.followAnchorIndex).toBe(1)
  expect(view.diagonalizeAnchorRow).toBe(2)

  view.removeRow(2)
  expect(view.followAnchorIndex).toBe(1)
  expect(view.diagonalizeAnchorRow).toBe(1)
})

test('a feature panel follows its band to the index it moves to', async () => {
  const { session, view } = await openStack()
  const track = view.levels[2]!.tracks[0]!
  const widget = session.addWidget('SyntenyFeatureWidget', 'syntenyFeature', {
    featureData: { uniqueId: 'f', refName: 'ctgA', start: 0, end: 10 },
    view,
    track,
  }) as unknown as { level: number | undefined }
  expect(widget.level).toBe(2)

  view.removeRow(0)
  expect(widget.level).toBe(1)

  view.removeRow(2)
  expect(widget.level).toBeUndefined()
})

test('the menu names every row once a third is stacked, and none before', async () => {
  const { view } = await openStack()
  const [item] = removeRowMenuItems(view)
  expect(item && 'subMenu' in item ? item.subMenu : undefined).toHaveLength(4)

  view.removeRow(0)
  view.removeRow(0)
  expect(removeRowMenuItems(view)).toEqual([])
})

test('reversing the stack keeps every row, band and anchor with its partner', async () => {
  const { view } = await openStack()
  const rowIds = view.views.map(v => v.id)
  const bandIds = view.levels.map(l => l.id)
  view.levels[0]!.setHeight(140)
  view.setFollowAnchorIndex(0)
  view.setDiagonalizeAnchorRow(1)

  view.reverseRows()

  expect(rows(view)).toEqual(['asmD', 'asmC', 'asmB', 'asmA'])
  expect(bands(view)).toEqual([['asmC_asmD'], ['asmB_asmC'], ['asmA_asmB']])
  expect(view.views.map(v => v.id)).toEqual([...rowIds].reverse())
  expect(view.levels.map(l => l.id)).toEqual([...bandIds].reverse())
  expect(view.levels.map(l => l.height)).toEqual([100, 100, 140])
  expect(view.levels.map(l => l.assemblyNames)).toEqual([
    ['asmD', 'asmC'],
    ['asmC', 'asmB'],
    ['asmB', 'asmA'],
  ])
  expect(view.followAnchorIndex).toBe(3)
  expect(view.diagonalizeAnchorRow).toBe(2)
})
