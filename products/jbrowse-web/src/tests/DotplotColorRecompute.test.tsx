import { waitFor } from '@testing-library/react'

import configSnapshot from '../../test_data/grape_peach_synteny/config.json' with { type: 'json' }
import {
  grapePeachGetFile,
  utilizeFetchMockForTest,
} from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

utilizeFetchMockForTest(grapePeachGetFile)

async function loadedDotplotDisplay() {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = session.addView('DotplotView', {
    init: {
      views: [{ assembly: 'peach' }, { assembly: 'grape' }],
      tracks: ['subset'],
    },
  })
  view.setWidth(800)
  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )
  const display = view.tracks[0].displays[0]
  await waitFor(
    () => {
      expect(display.instanceData).toBeDefined()
    },
    { timeout: 30000 },
  )
  return { view, display }
}

// The rpcProps/gpuProps split: positions come from the fetch + zoom, colors are
// a separate main-thread pass. Palette changes are the common interaction, and
// rebuilding positions for one re-walks every CIGAR of every feature.
test('a colorBy change recolors without rebuilding geometry', async () => {
  const { view, display } = await loadedDotplotDisplay()
  const positions = display.instanceData
  const colorsBefore = Uint32Array.from(display.geometry.colors)

  view.setColorBy('strand')

  expect(display.instanceData).toBe(positions)
  expect(display.geometry.colors).not.toStrictEqual(colorsBefore)
  expect(display.geometry.colors.length).toBe(colorsBefore.length)
}, 45000)

test('an alpha change recolors without rebuilding geometry', async () => {
  const { view, display } = await loadedDotplotDisplay()
  const positions = display.instanceData
  const colorsBefore = Uint32Array.from(display.geometry.colors)

  view.setAlpha(0.5)

  expect(display.instanceData).toBe(positions)
  // alpha lives in the high byte of the packed ABGR color
  expect(display.geometry.colors[0]! >>> 24).toBe(128)
  expect(colorsBefore[0]! >>> 24).toBe(255)
}, 45000)
