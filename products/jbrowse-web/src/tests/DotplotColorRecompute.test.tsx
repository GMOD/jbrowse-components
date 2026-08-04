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

// alpha and minAlignmentLength are stored on the view, not per display. They
// used to be per display while every control was view-level and fanned its
// setter out over the displays that existed at the time — so a track shown after
// the slider moved rendered at the default while the slider said otherwise.
test('a track shown after a settings change inherits them', async () => {
  const { view } = await loadedDotplotDisplay()
  // both moved off their defaults BEFORE the second track exists, which is
  // exactly what a fan-out setter cannot reach
  view.setAlpha(0.5)
  view.setMinAlignmentLength(1e9)

  view.showTrack('peach_grape_small')
  await waitFor(
    () => {
      expect(view.tracks.length).toBe(2)
    },
    { timeout: 30000 },
  )
  const added = view.dotplotDisplays[1]
  await waitFor(
    () => {
      expect(added.geometry).toBeDefined()
    },
    { timeout: 30000 },
  )

  // the length filter was in force for this display's very first geometry build
  expect(added.alpha).toBe(0.5)
  expect(added.geometry.instanceCount).toBe(0)

  // and the inherited alpha is what it actually paints with, not just what it
  // reports: 0.5 -> 128 in the high byte of the packed ABGR color
  view.setMinAlignmentLength(0)
  expect(added.geometry.instanceCount).toBeGreaterThan(0)
  expect(added.geometry.colors[0]! >>> 24).toBe(128)
}, 45000)

// Two alignment files drawn into one plot used to be indistinguishable — same
// mode, same black points. colorBy:'track' is what tells them apart, and the
// palette is assigned by the view so a color pinned on one shifts what the
// other can automatically take.
async function twoOverlaidTracks() {
  const { rootModel } = getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const view = rootModel.session!.addView('DotplotView', {
    init: {
      views: [{ assembly: 'peach' }, { assembly: 'grape' }],
      tracks: ['subset', 'peach_grape_small'],
    },
  })
  view.setWidth(800)
  await waitFor(
    () => {
      expect(view.tracks.length).toBe(2)
    },
    { timeout: 30000 },
  )
  return view
}

test('overlaid tracks get distinct colors, and a pin displaces its sibling', async () => {
  const view = await twoOverlaidTracks()
  const [a, b] = view.tracks.map(
    (t: { configuration: { trackId: string } }) => t.configuration.trackId,
  )

  expect(view.trackColorFor(a)).not.toBe(view.trackColorFor(b))

  // pin the color the second track had been given automatically
  const wanted = view.trackColorFor(b)
  view.setTrackColor(a, wanted)
  expect(view.trackColorFor(a)).toBe(wanted)
  expect(view.trackColorFor(b)).not.toBe(wanted)

  view.clearTrackColorSettings()
  expect(view.trackColorFor(a)).not.toBe(wanted)
}, 45000)

test('a per-track mode overrides the plot-wide one until a plot-wide pick', async () => {
  const view = await twoOverlaidTracks()
  const [a, b] = view.tracks.map(
    (t: { configuration: { trackId: string } }) => t.configuration.trackId,
  )

  view.setColorBy('strand')
  expect(view.uniformColorBy).toBe('strand')

  view.setTrackColorBy(a, 'identity')
  expect(view.resolveColorBy(a)).toBe('identity')
  expect(view.resolveColorBy(b)).toBe('strand')
  // tracks disagree, so there is no single mode to report
  expect(view.uniformColorBy).toBeUndefined()
  expect(view.colorLegendChips.map((c: { label: string }) => c.label)).toEqual([
    expect.stringContaining('— Identity'),
    expect.stringContaining('— Strand'),
  ])

  // a plot-wide pick has to mean all tracks, not "all except the pinned ones"
  view.setColorBy('query')
  expect(view.resolveColorBy(a)).toBe('query')
  expect(view.uniformColorBy).toBe('query')
}, 45000)
