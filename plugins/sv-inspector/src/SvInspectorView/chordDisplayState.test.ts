import { SimpleFeature } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { when } from 'mobx'

import { openInspector } from './testUtils.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function bnd(uniqueId: string, start: number, alt: string, event?: string) {
  return {
    feature: { uniqueId, refName: 'ctgA', start, end: start + 1, ALT: [alt] },
    cellData: { 'INFO.SVTYPE': 'BND', 'INFO.EVENT': event },
  }
}

const rows = [
  bnd('a', 100, 'C]ctgB:900]', 'cluster_1'),
  bnd('b', 5000, 'C]ctgB:70]', 'cluster_1'),
  bnd('c', 9000, 'C]ctgB:20]'),
]

async function inspectorWithRows() {
  const { session, view } = await openInspector()
  await session.assemblyManager.waitForAssembly('volvox')
  view.spreadsheetView.displaySpreadsheet({
    assemblyName: 'volvox',
    columns: [{ name: 'INFO.SVTYPE' }, { name: 'INFO.EVENT' }],
    rowSet: { rows },
  })
  return { session, view }
}

test('selecting a record of an event names the chords of that event', async () => {
  const { session, view } = await inspectorWithRows()
  expect(view.highlightedChordIds).toBeUndefined()

  session.setSelection(new SimpleFeature(rows[1]!.feature))
  expect(view.highlightedChordIds).toEqual(['a', 'b'])

  await when(() => view.circularView.tracks.length > 0)
  const [display] = view.circularView.tracks[0]!.displays
  expect(display.highlightedFeatureIds).toEqual(['a', 'b'])

  session.setSelection(new SimpleFeature(rows[2]!.feature))
  expect(view.highlightedChordIds).toBeUndefined()
  expect(display.highlightedFeatureIds).toBeUndefined()
})

test('a filter narrows what the chord display draws, on the same track', async () => {
  const { view } = await inspectorWithRows()
  await when(() => view.circularView.tracks.length > 0)
  const track = view.circularView.tracks[0]!
  const [display] = track.displays
  expect(track.configuration.adapter.features).toHaveLength(3)
  expect(display.visibleFeatureIds).toBeUndefined()

  view.spreadsheetView.spreadsheet!.setSvEventFilter('cluster_1')

  expect(view.circularView.tracks[0]).toBe(track)
  expect(track.configuration.adapter.features).toHaveLength(3)
  expect(display.visibleFeatureIds).toEqual(['a', 'b'])
  display.setFeatures(rows.map(r => new SimpleFeature(r.feature)))
  expect(display.drawnFeatures.map((f: SimpleFeature) => f.id())).toEqual([
    'a',
    'b',
  ])

  view.spreadsheetView.spreadsheet!.setSvEventFilter(undefined)
  expect(display.visibleFeatureIds).toBeUndefined()
})

test('the snapshot drops the generated chord track but keeps a second one', async () => {
  const { session, view } = await inspectorWithRows()
  session.addSessionTrackConf({
    type: 'VariantTrack',
    trackId: 'normal',
    name: 'normal',
    assemblyNames: ['volvox'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  await when(() => view.circularView.tracks.length > 0)
  await view.circularView.launchTrack('normal')
  expect(view.circularView.tracks).toHaveLength(2)

  const snap = getSnapshot(view) as {
    circularView: { tracks?: { configuration: unknown }[] }
  }
  expect(snap.circularView.tracks?.map(t => t.configuration)).toEqual([
    'normal',
  ])
})
