import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  findDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

import type { WebRootModel } from '../rootModel/rootModel.ts'
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

// The display's `rows.domain` as the session's delta for the track carries it.
function rowsDomainInDelta(delta: unknown) {
  const displays = (delta as { displays?: unknown } | undefined)?.displays
  return Array.isArray(displays)
    ? (displays[0] as { rows?: { domain?: string[] } } | undefined)?.rows
        ?.domain
    : undefined
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
    expect(display.sourcesWithoutLayout).toHaveLength(2)
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
