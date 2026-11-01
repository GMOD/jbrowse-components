import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

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

async function launchRows(views: Record<string, unknown>[]) {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox'))
  session.addAssemblyConf(assembly('volvox2'))
  session.addSessionTrackConf({
    type: 'FeatureTrack',
    trackId: 'volvox_genes',
    assemblyNames: ['volvox'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  const view = (await session.launchView('LinearSyntenyView', {
    views,
  })) as LinearSyntenyViewModel
  const navs: jest.SpyInstance[] = []
  const { setViews } = view
  jest.spyOn(view, 'setViews').mockImplementation(snaps => {
    setViews(snaps)
    for (const row of view.views) {
      navs.push(jest.spyOn(row, 'navToLocString').mockResolvedValue(true))
    }
  })
  view.setWidth(800)
  await when(() => view.pendingLaunch === undefined)
  return { view, navs }
}

async function rowNavCalls(views: Record<string, unknown>[]) {
  const { navs } = await launchRows(views)
  return navs.map(n => n.mock.calls)
}

// hand-written JSON writes a lone track bare; a string is iterable, so a row
// looping it opened one track per letter
test('a row takes a bare trackId string as a list of one', async () => {
  const { view, navs } = await launchRows([
    { assembly: 'volvox', loc: 'TP53', tracks: 'volvox_genes' },
    { assembly: 'volvox2', loc: 'TP53' },
  ])
  expect(view.views[0]!.tracks.map(t => t.configuration.trackId)).toEqual([
    'volvox_genes',
  ])
  expect(navs[0]!.mock.calls).toEqual([
    ['TP53', 'volvox', undefined, { showHitTrack: false }],
  ])
})

// a row naming its own tracks must not also open the hit track
test('a row loc forwards grow and defaults showHitTrack from its tracks', async () => {
  const calls = await rowNavCalls([
    { assembly: 'volvox', loc: 'TP53', grow: 0.2, tracks: ['volvox_genes'] },
    { assembly: 'volvox2', loc: 'TP53' },
  ])
  expect(calls).toEqual([
    [['TP53', 'volvox', 0.2, { showHitTrack: false }]],
    [['TP53', 'volvox2', undefined, { showHitTrack: true }]],
  ])
})

test('an explicit showHitTrack wins over the tracks default', async () => {
  const calls = await rowNavCalls([
    {
      assembly: 'volvox',
      loc: 'TP53',
      showHitTrack: true,
      tracks: ['volvox_genes'],
    },
    { assembly: 'volvox2', loc: 'TP53', showHitTrack: false },
  ])
  expect(calls).toEqual([
    [['TP53', 'volvox', undefined, { showHitTrack: true }]],
    [['TP53', 'volvox2', undefined, { showHitTrack: false }]],
  ])
})
