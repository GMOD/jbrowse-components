import { isSlotCustomized } from '@jbrowse/core/configuration'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  hts,
  volvoxConfigWithTracks,
} from './util.tsx'

import type { ResolvableDisplay } from '@jbrowse/core/configuration'
import type { SnackAction } from '@jbrowse/core/util'

// The pin as a user meets it: the real track menu, the real adornment, a click
// on the button by its accessible name, and what the tracks and the session do
// afterwards. Every unit test below this one fakes at least one of those, and
// the one regression that reached a live session (a pin beside an unchecked
// "View as pairs" that applied *off* everywhere) passed all of them.

const delay = { timeout: 30000 }
const opts = [{}, delay] as const

interface TestSession {
  getDisplayTypeDefault: (displayType: string, slot: string) => unknown
  snackbarMessages: { message: string; actions?: SnackAction[] }[]
}

jest.setTimeout(60000)

beforeEach(() => {
  // a promoted default persists to localStorage, so one test's promotion would
  // otherwise decide the next one's starting cascade
  localStorage.clear()
  doBeforeEach()
})

// `configTracks` are the tracks the selector offers, `trackIds` the ones opened
// up front; a test that opens one later names it in the first list only
async function openTracks(trackIds: string[], configTracks = trackIds) {
  const result = await createView(volvoxConfigWithTracks(configTracks))
  for (const id of trackIds) {
    fireEvent.click(await result.findByTestId(hts(id), ...opts))
  }
  await waitFor(() => {
    expect(result.view.tracks).toHaveLength(trackIds.length)
  }, delay)
  const session = result.session as unknown as TestSession
  const displayOf = (trackId: string) =>
    result.view.tracks.find(t => t.configuration.trackId === trackId)!
      .displays[0] as ResolvableDisplay & Record<string, unknown>
  return { ...result, session, displayOf }
}

async function openTrackMenu(index: number) {
  const icons = await screen.findAllByTestId('track_menu_icon', ...opts)
  fireEvent.click(icons[index]!)
}

function lastOffer(session: TestSession) {
  const last = session.snackbarMessages.at(-1)
  const [action, ...rest] = last?.actions ?? []
  if (!last || !action || rest.length) {
    throw new Error(
      `expected one snackbar action, got ${JSON.stringify(last?.actions?.map(a => a.name))}`,
    )
  }
  return { message: last.message, action }
}

const PAIRS = 'View as pairs / link supplementary alignments'

test('the pin beside an unchecked checkbox turns the setting on for every open track and offers it as the default', async () => {
  const { session, displayOf } = await openTracks([
    'volvox_cram_alignments',
    'volvox_alignments',
  ])
  expect(displayOf('volvox_cram_alignments').linkedReads).toBe('off')
  expect(displayOf('volvox_alignments').linkedReads).toBe('off')

  await openTrackMenu(0)
  fireEvent.click(await screen.findByText('Read connections', ...opts))
  const pin = await screen.findByRole(
    'button',
    { name: `turn ${PAIRS} on for all open tracks of this type` },
    delay,
  )
  expect(pin.getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(pin)

  expect(displayOf('volvox_cram_alignments').linkedReads).toBe('normal')
  expect(displayOf('volvox_alignments').linkedReads).toBe('normal')

  const { message, action } = lastOffer(session)
  expect(message).toBe('Applied to 2 open tracks')
  expect(action.name).toBe('Set as the default')
  expect(
    session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'linkedReads'),
  ).toBeUndefined()
  action.onClick()
  expect(
    session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'linkedReads'),
  ).toBe('normal')

  // the row is now ticked, so the same pin reads as the off switch and is
  // drawn pressed, mirroring the checkbox
  const flipped = await screen.findByRole(
    'button',
    { name: `turn ${PAIRS} off for all open tracks of this type` },
    delay,
  )
  expect(flipped.getAttribute('aria-pressed')).toBe('true')
})

test('the pin beside a checked checkbox turns the setting off everywhere and offering the base clears the default', async () => {
  const { session, displayOf } = await openTracks(['volvox_cram_alignments'])
  await openTrackMenu(0)
  fireEvent.click(await screen.findByText('Read connections', ...opts))
  fireEvent.click(
    await screen.findByRole(
      'button',
      { name: `turn ${PAIRS} on for all open tracks of this type` },
      delay,
    ),
  )
  lastOffer(session).action.onClick()
  expect(
    session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'linkedReads'),
  ).toBe('normal')

  fireEvent.click(
    await screen.findByRole(
      'button',
      { name: `turn ${PAIRS} off for all open tracks of this type` },
      delay,
    ),
  )
  expect(displayOf('volvox_cram_alignments').linkedReads).toBe('off')
  lastOffer(session).action.onClick()
  // off is the slot's base, so the offer clears rather than storing a no-op
  expect(
    session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'linkedReads'),
  ).toBeUndefined()
})

test('the pin beside a radio option applies it everywhere, fills once promoted, and a second click clears the default', async () => {
  const { session, displayOf } = await openTracks([
    'gff3tabix_genes',
    'bigbed_genes',
  ])
  expect(displayOf('gff3tabix_genes').displayMode).toBe('normal')

  await openTrackMenu(0)
  fireEvent.click(await screen.findByText('Set feature height', ...opts))
  fireEvent.click(
    await screen.findByRole(
      'button',
      { name: 'apply Compact to all open tracks of this type' },
      delay,
    ),
  )
  expect(displayOf('gff3tabix_genes').displayMode).toBe('compact')
  expect(displayOf('bigbed_genes').displayMode).toBe('compact')

  const { message, action } = lastOffer(session)
  expect(message).toBe('Applied to 2 open tracks')
  action.onClick()
  expect(
    session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
  ).toBe('compact')

  const filled = await screen.findByRole(
    'button',
    { name: 'clear the default for Compact for all tracks of this type' },
    delay,
  )
  expect(filled.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(filled)
  expect(
    session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
  ).toBeUndefined()
  // clearing the default writes no track
  expect(displayOf('gff3tabix_genes').displayMode).toBe('compact')
  expect(displayOf('bigbed_genes').displayMode).toBe('compact')
})

test('a track opened after "Set as the default" follows the promoted state without being customized', async () => {
  const { session, view, findByTestId, displayOf } = await openTracks(
    ['volvox_cram_alignments'],
    ['volvox_cram_alignments', 'volvox_alignments'],
  )
  await openTrackMenu(0)
  fireEvent.click(await screen.findByText('Read connections', ...opts))
  fireEvent.click(
    await screen.findByRole(
      'button',
      { name: `turn ${PAIRS} on for all open tracks of this type` },
      delay,
    ),
  )
  lastOffer(session).action.onClick()

  // the menu is a modal; the second track is picked from the selector
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
  fireEvent.click(await findByTestId(hts('volvox_alignments'), ...opts))
  await waitFor(() => {
    expect(view.tracks).toHaveLength(2)
  }, delay)

  const later = displayOf('volvox_alignments')
  expect(later.linkedReads).toBe('normal')
  expect(isSlotCustomized(later, 'linkedReads')).toBe(false)
})
