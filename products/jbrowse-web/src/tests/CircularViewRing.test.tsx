import { waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  findDisplayPainted,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

import type { CircularViewModel } from '@jbrowse/plugin-circular-view'

setup()

beforeEach(() => {
  doBeforeEach()
})

const config = volvoxConfigWithTracks(['volvox_microarray'])

const timeout = 30000

// #region ringView
const ringView = {
  type: 'CircularView',
  assembly: 'volvox',
  tracks: ['volvox_microarray'],
}
// #endregion

test('a bigwig track on a circular view draws as a ring', async () => {
  const { view: created } = await createView({
    ...config,
    defaultSession: {
      name: 'ring',
      views: [{ id: 'ring_view', ...ringView }],
    },
  })
  const view = created as unknown as CircularViewModel
  const strip = await findDisplayPainted('wiggle-display', { timeout })
  expect(strip.dataset.displayId).toBe('volvox_microarray-LinearWiggleDisplay')
  expect(strip.closest('[data-testid="circular-ring-strips"]')).not.toBeNull()

  const { ringHost } = view
  expect(ringHost.rings).toHaveLength(1)
  expect(ringHost.width).toBeCloseTo(view.circumferencePx)
  expect(ringHost.chordRadiusPx).toBeLessThan(view.radiusPx)

  await waitFor(
    () => {
      const canvas = document.querySelector<HTMLElement>(
        '[data-testid="circular-ring-canvas"]',
      )
      expect(canvas?.dataset.displayDrawn).toBe('true')
    },
    { timeout },
  )
}, 60000)
