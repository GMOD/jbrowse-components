import { openTracks, openViews } from '@jbrowse/core/util/openViews'
import { when } from 'mobx'

import { openInspector } from './testUtils.ts'

import type { SvInspectorViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// jest's deep equality throws walking an MST instance
const ids = (views: { id: string }[]) => views.map(v => v.id)

const feature = {
  refName: 'ctgA',
  start: 100,
  end: 200,
  uniqueId: 'sv1',
  ALT: ['<DUP>'],
}

function loadSheet(view: SvInspectorViewModel) {
  view.spreadsheetView.displaySpreadsheet({
    assemblyName: 'volvox',
    columns: [{ name: 'INFO.SVTYPE' }],
    rowSet: { rows: [{ feature, cellData: { 'INFO.SVTYPE': 'DUP' } }] },
  })
}

test('the sheet is declared, and the unshown circle is not', async () => {
  const { session, view } = await openInspector()

  expect(view.showCircularView).toBe(false)
  expect(ids(view.ownViews)).toEqual([view.spreadsheetView.id])
  expect(ids(openViews(session))).toEqual([view.id, view.spreadsheetView.id])
})

// AppReadyMarker reads an uninitialized view as loading
test('the unshown circle would never satisfy the marker', async () => {
  const { view } = await openInspector()

  expect(view.circularView.initialized).toBe(false)
  expect(view.showLoading).toBe(false)
})

test('the circle joins the census once the sheet shows it', async () => {
  const { session, view } = await openInspector()
  loadSheet(view)

  await when(() => view.showCircularView)

  expect(ids(view.ownViews)).toEqual([
    view.spreadsheetView.id,
    view.circularView.id,
  ])
  expect(ids(openViews(session))).toEqual([
    view.id,
    view.spreadsheetView.id,
    view.circularView.id,
  ])
})

test('the chord track reaches the census with it', async () => {
  const { session, view } = await openInspector()
  loadSheet(view)

  await when(() => view.showCircularView && view.circularView.tracks.length > 0)

  expect(
    openTracks(session).map(
      t => (t.configuration as { trackId?: string }).trackId,
    ),
  ).toEqual([view.variantTrackId])
})
