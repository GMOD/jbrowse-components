import { fireEvent, waitFor } from '@testing-library/react'

import { openMultiSampleVariantDisplay } from './testLinearMultiSampleVariantDisplay.tsx'
import {
  createView,
  doBeforeEach,
  findDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

import type { WebRootModel } from '../rootModel/rootModel.ts'
import type { LinearMultiSampleVariantDisplayModel } from '@jbrowse/plugin-variants'
import type { LinearWiggleDisplayModel } from '@jbrowse/plugin-wiggle/LinearWiggleDisplay/stateModel'

setup()

const TRACK_ID = 'volvox_microarray_multi_multirowxy'
const config = volvoxConfigWithTracks([TRACK_ID])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 60000 }

const sleep = (ms: number) =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

// A display's `rows.domain` as the session's delta for the track carries it.
function rowsDomainInDelta(delta: unknown, displayId?: string) {
  const displays = (delta as { displays?: unknown } | undefined)?.displays
  if (!Array.isArray(displays)) {
    return undefined
  }
  const entries = displays as {
    displayId?: string
    rows?: { domain?: string[] }
  }[]
  const entry = displayId
    ? entries.find(d => d.displayId === displayId)
    : entries[0]
  return entry?.rows?.domain
}

// An arrangement write reaches the session's delta at once rather than after
// the track's 400 ms save, so it is one undo step the moment it lands, and an
// undo inside that wait stays undone once the deferred save fires.
test('a row reorder lands in the session at once and stays undone across the deferred save', async () => {
  const { view, session, rootModel, findByTestId } = await createView(config)
  const { history } = rootModel as WebRootModel
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts(TRACK_ID), {}, delay))
  await findDisplayPainted('wiggle-display', delay)
  const display: LinearWiggleDisplayModel = view.tracks[0]!.displays[0]
  await waitFor(() => {
    expect(display.discoveredRows).toHaveLength(2)
  }, delay)
  await sleep(700)
  const stepsBefore = history.undoIdx

  display.setRowOrder([{ name: 'k2' }, { name: 'k1' }])

  expect(rowsDomainInDelta(session.trackConfigDeltas[TRACK_ID])).toEqual([
    'k2',
    'k1',
  ])
  expect(display.sources.map(s => s.name)).toEqual(['k2', 'k1'])

  await sleep(350)
  expect(history.undoIdx).toBe(stepsBefore + 1)
  history.undo()
  expect(history.undoIdx).toBe(stepsBefore)

  expect(rowsDomainInDelta(session.trackConfigDeltas[TRACK_ID])).toBeUndefined()
  await sleep(500)
  expect(rowsDomainInDelta(session.trackConfigDeltas[TRACK_ID])).toBeUndefined()
  const undone: LinearWiggleDisplayModel = view.tracks[0]!.displays[0]
  expect(undone.rowDomain).toEqual([])
  expect(undone.sources.map(s => s.name)).toEqual(['k1', 'k2'])
}, 60000)

// The same on the multi-sample variant display, whose rows are its samples and
// whose `rows` object has no field.
test('a variant row reorder lands in the session at once and undoes', async () => {
  const { view, session, rootModel } = await openMultiSampleVariantDisplay({
    displayType: 'regular',
  })
  const { history } = rootModel as WebRootModel
  await findDisplayPainted('variant-display', delay)
  const display: LinearMultiSampleVariantDisplayModel =
    view.tracks[0]!.displays[0]
  await waitFor(() => {
    expect(display.sources.length).toBeGreaterThan(2)
  }, delay)
  await sleep(700)
  const { displayId } = display.configuration
  const stepsBefore = history.undoIdx
  const before = display.sources.map(s => s.name)
  const reversed = [...before].reverse()

  display.setRowOrder(reversed.map(name => ({ name })))

  expect(
    rowsDomainInDelta(session.trackConfigDeltas.volvox_test_vcf, displayId),
  ).toEqual(reversed)
  expect(display.sources.map(s => s.name)).toEqual(reversed)

  await sleep(350)
  expect(history.undoIdx).toBe(stepsBefore + 1)
  history.undo()
  expect(history.undoIdx).toBe(stepsBefore)

  await sleep(500)
  expect(
    rowsDomainInDelta(session.trackConfigDeltas.volvox_test_vcf, displayId),
  ).toBeUndefined()
  const undone: LinearMultiSampleVariantDisplayModel =
    view.tracks[0]!.displays[0]
  expect(undone.rowDomain).toEqual([])
  expect(undone.sources.map(s => s.name)).toEqual(before)
}, 60000)

// The multi-row feature display's model type is not a published export, so
// the test names the four members it drives.
interface MultiRowDisplay {
  configuration: { displayId: string }
  sources: { name: string }[]
  rowDomain: string[]
  setRowOrder: (rows: { name: string }[]) => void
}

// The same on the multi-row feature display, whose rows are the values of a
// feature attribute rather than subtracks or samples.
test('a multi-row reorder lands in the session at once and undoes', async () => {
  const PAINTING = 'volvox_mouse_inheritance_painting'
  const { view, session, rootModel, findByTestId } = await createView(
    volvoxConfigWithTracks([PAINTING]),
  )
  const { history } = rootModel as WebRootModel
  view.setNewView(50, 0)
  fireEvent.click(await findByTestId(hts(PAINTING), {}, delay))
  await findDisplayPainted('multirow-display', delay)
  const display: MultiRowDisplay = view.tracks[0]!.displays[0]
  await waitFor(() => {
    expect(display.sources.length).toBeGreaterThan(2)
  }, delay)
  await sleep(700)
  const { displayId } = display.configuration
  const stepsBefore = history.undoIdx
  const before = display.sources.map(s => s.name)
  const reversed = [...before].reverse()

  display.setRowOrder(reversed.map(name => ({ name })))

  expect(
    rowsDomainInDelta(session.trackConfigDeltas[PAINTING], displayId),
  ).toEqual(reversed)
  expect(display.sources.map(s => s.name)).toEqual(reversed)

  await sleep(350)
  expect(history.undoIdx).toBe(stepsBefore + 1)
  history.undo()
  expect(history.undoIdx).toBe(stepsBefore)

  await sleep(500)
  expect(
    rowsDomainInDelta(session.trackConfigDeltas[PAINTING], displayId),
  ).toBeUndefined()
  const undone: MultiRowDisplay = view.tracks[0]!.displays[0]
  expect(undone.rowDomain).toEqual([])
  expect(undone.sources.map(s => s.name)).toEqual(before)
}, 60000)

// The MAF display's model type is not a published export either.
interface MafDisplay extends MultiRowDisplay {
  rowTree: string | undefined
}

// The same on the MAF display, whose rows are species and whose adapter
// supplies a guide tree: a reorder that parts the sister leaves volvox and
// simvolvox, which no rotation of the tree does, hides it, and the undo that
// returns the declared order brings it back.
test('a MAF reorder lands in the session at once and undoes', async () => {
  const MAF = 'volvox_maf'
  const { view, session, rootModel, findByTestId } = await createView(
    volvoxConfigWithTracks([MAF]),
  )
  const { history } = rootModel as WebRootModel
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts(MAF), {}, delay))
  await findDisplayPainted('maf-display', delay)
  const display: MafDisplay = view.tracks[0]!.displays[0]
  await waitFor(() => {
    expect(display.sources.length).toBeGreaterThan(2)
    expect(display.rowTree).toBeDefined()
  }, delay)
  await sleep(700)
  const { displayId } = display.configuration
  const stepsBefore = history.undoIdx
  const before = display.sources.map(s => s.name)
  const parted = [...before.filter(name => name !== 'simvolvox'), 'simvolvox']

  display.setRowOrder(parted.map(name => ({ name })))

  expect(rowsDomainInDelta(session.trackConfigDeltas[MAF], displayId)).toEqual(
    parted,
  )
  expect(display.sources.map(s => s.name)).toEqual(parted)
  expect(display.rowTree).toBeUndefined()

  await sleep(350)
  expect(history.undoIdx).toBe(stepsBefore + 1)
  history.undo()
  expect(history.undoIdx).toBe(stepsBefore)

  await sleep(500)
  expect(
    rowsDomainInDelta(session.trackConfigDeltas[MAF], displayId),
  ).toBeUndefined()
  const undone: MafDisplay = view.tracks[0]!.displays[0]
  expect(undone.rowDomain).toEqual([])
  expect(undone.sources.map(s => s.name)).toEqual(before)
  expect(undone.rowTree).toBeDefined()
}, 60000)

// The same on the mark display, whose rows are a field's values split by the
// worker: the volvox MultiWiggle's four BigWigs as bars, one row per source.
test('a mark display row reorder lands in the session at once and undoes', async () => {
  const MARKS = 'multiwig_mark_rows'
  const base = volvoxConfigWithTracks(['volvox_microarray_multi'])
  const { view, session, rootModel, findByTestId } = await createView({
    ...base,
    tracks: [
      {
        ...base.tracks[0],
        trackId: MARKS,
        name: MARKS,
        category: [],
        displays: [
          {
            type: 'LinearMarkDisplay',
            displayId: `${MARKS}-marks`,
            rows: 'source',
            marks: [{ mark: 'bar', encoding: { y: 'score' } }],
          },
        ],
      },
    ],
  })
  const { history } = rootModel as WebRootModel
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts(MARKS), {}, delay))
  await findDisplayPainted('mark-display', delay)
  const display: MultiRowDisplay = view.tracks[0]!.displays[0]
  await waitFor(() => {
    expect(display.sources.length).toBeGreaterThan(2)
  }, delay)
  await sleep(700)
  const { displayId } = display.configuration
  const stepsBefore = history.undoIdx
  const before = display.sources.map(s => s.name)
  const reversed = [...before].reverse()

  display.setRowOrder(reversed.map(name => ({ name })))

  expect(
    rowsDomainInDelta(session.trackConfigDeltas[MARKS], displayId),
  ).toEqual(reversed)
  expect(display.sources.map(s => s.name)).toEqual(reversed)

  await sleep(350)
  expect(history.undoIdx).toBe(stepsBefore + 1)
  history.undo()
  expect(history.undoIdx).toBe(stepsBefore)

  await sleep(500)
  expect(
    rowsDomainInDelta(session.trackConfigDeltas[MARKS], displayId),
  ).toBeUndefined()
  const undone: MultiRowDisplay = view.tracks[0]!.displays[0]
  expect(undone.rowDomain).toEqual([])
  expect(undone.sources.map(s => s.name)).toEqual(before)
}, 60000)
