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

async function rowNavCalls(views: Record<string, unknown>[]) {
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
  return navs.map(n => n.mock.calls)
}

// A row naming its own tracks must not also open the track a gene symbol was
// found in, which on a GenArk panel put two copies of the gene track side by
// side, and a host padding a symbol locus needs `grow` to reach the row.
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
