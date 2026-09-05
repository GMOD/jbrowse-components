import { openTracks, openViews } from '@jbrowse/core/util/openViews'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { SvInspectorViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// This view keeps its two halves on named props — `spreadsheetView` and
// `circularView` — so no spelling of the duck-typed walk ADR-103 replaced ever
// reached them, and the gap outlived the walk: the declaration went in gated,
// because an ungated one parks the readiness marker forever.

// A config-inline assembly, so `spreadsheet.initialized` can become true
// without a fetch — that getter waits on the assembly manager, and it is what
// `showCircularView` reads.
function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 16000,
            seq: 'a'.repeat(16000),
          },
        ],
      },
    },
  })
  return session
}

async function open(session: ReturnType<typeof setup>) {
  const view = (await session.launchView(
    'SvInspectorView',
    {},
  )) as SvInspectorViewModel
  view.setWidth(800)
  return view
}

// By id, not by node: jest's deep equality walks an MST instance into
// `Factory.Type`, which throws by design.
const ids = (views: { id: string }[]) => views.map(v => v.id)

const feature = {
  refName: 'ctgA',
  start: 100,
  end: 200,
  uniqueId: 'sv1',
  ALT: ['<DUP>'],
}

// What a parsed file leaves on the sheet. Written directly rather than imported,
// so the gate is exercised without a parser in the way.
function loadSheet(view: SvInspectorViewModel) {
  view.spreadsheetView.displaySpreadsheet({
    assemblyName: 'volvox',
    columns: [{ name: 'INFO.SVTYPE' }],
    rowSet: { rows: [{ feature, cellData: { 'INFO.SVTYPE': 'DUP' } }] },
  })
}

test('the sheet is declared, and the unshown circle is not', async () => {
  const session = setup()
  const view = await open(session)

  expect(view.showCircularView).toBe(false)
  expect(ids(view.ownViews)).toEqual([view.spreadsheetView.id])
  expect(ids(openViews(session))).toEqual([view.id, view.spreadsheetView.id])
})

// The reason the gate is not cosmetic. `AppReadyMarker` reads `initialized ===
// false` as a view still loading, and a circle that is never rendered is never
// given a width, so it never initializes. Declared ungated, this is the value
// that would hold `data-app-phase` at `loading` for the whole session.
test('the unshown circle would never satisfy the marker', async () => {
  const view = await open(setup())

  expect(view.circularView.initialized).toBe(false)
  expect(view.showLoading).toBe(false)
})

test('the circle joins the census once the sheet shows it', async () => {
  const session = setup()
  const view = await open(session)
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

// The payoff, and the thing the walk was blind to: the chord track the view
// builds from the sheet lives on the circular view, so it reached no consumer
// asking the session what tracks are open.
test('the chord track reaches the census with it', async () => {
  const session = setup()
  const view = await open(session)
  loadSheet(view)

  // Both: the track binding runs off the sheet's rows, which land before the
  // assembly the gate waits on has finished loading.
  await when(() => view.showCircularView && view.circularView.tracks.length > 0)

  expect(
    openTracks(session).map(
      t => (t.configuration as { trackId?: string }).trackId,
    ),
  ).toEqual([view.variantTrackId])
})
