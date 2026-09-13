import { act, fireEvent, waitFor } from '@testing-library/react'
import { autorun } from 'mobx'

import {
  createView,
  doBeforeEach,
  findSettledDisplay,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 20000

// The whole app over a user cancel: the chrome publishes `canceled` and keeps
// Retry on screen, the app marker reads ready because nothing is working, and
// Retry takes both back through loading.
test('a canceled track is finished for the app marker and Retry recovers it', async () => {
  const { view, findByTestId, getByTestId } = await createView(
    volvoxConfigWithTracks(['volvox_microarray']),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray'), {}, { timeout }))
  const chrome = await findSettledDisplay('wiggle-display', { timeout })
  const marker = getByTestId('app-ready-marker')
  await waitFor(
    () => {
      expect(marker.dataset.appPhase).toBe('ready')
    },
    { timeout },
  )

  const display = view.tracks[0]!.displays[0]! as unknown as {
    displayPhase: string
    cancelFetchByUser: () => void
  }
  const seen: string[] = []
  const dispose = autorun(() => {
    const phase = display.displayPhase
    if (seen.at(-1) !== phase) {
      seen.push(phase)
    }
  })

  act(() => {
    display.cancelFetchByUser()
  })
  expect(chrome.dataset.displayPhase).toBe('canceled')
  expect(marker.dataset.appPhase).toBe('ready')

  fireEvent.click(
    await findByTestId('loading-overlay-retry', {}, { timeout: 5000 }),
  )
  await findSettledDisplay('wiggle-display', { timeout })
  await waitFor(
    () => {
      expect(marker.dataset.appPhase).toBe('ready')
    },
    { timeout },
  )
  expect(seen).toEqual(['ready', 'canceled', 'loading', 'ready'])
  dispose()
}, 40000)
