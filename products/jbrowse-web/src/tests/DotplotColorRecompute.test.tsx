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
  const { rootModel } = await getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = await session.launchView('DotplotView', {
    views: [{ assembly: 'peach' }, { assembly: 'grape' }],
    tracks: ['subset'],
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

// Alpha is the one setting that recolors *nothing*. It rides the shader's
// `alpha` uniform (and `DotplotDrawParams.alpha` on the Canvas2D/SVG side), so a
// slider drag is a single scalar write rather than the three O(n) passes baking
// it into the packed byte used to cost: recompute colors, re-pack every
// instance, re-upload the buffer.
test('an alpha change rebuilds neither geometry nor colors', async () => {
  const { view, display } = await loadedDotplotDisplay()
  const positions = display.instanceData
  const colorsBefore = Uint32Array.from(display.geometry.colors)

  view.setAlpha(0.5)

  expect(display.instanceData).toBe(positions)
  expect(display.geometry.colors).toStrictEqual(colorsBefore)
  // the alpha byte stays saturated: opacity is never packed into these bytes
  expect(display.geometry.colors[0]! >>> 24).toBe(255)
  // ...and it reaches the draw path as a render-state scalar instead
  expect(view.dotplotRenderState.alpha).toBe(0.5)
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
  expect(view.minAlignmentLength).toBe(1e9)
  expect(added.geometry.instanceCount).toBe(0)

  view.setMinAlignmentLength(0)
  expect(added.geometry.instanceCount).toBeGreaterThan(0)

  // alpha reaches the newcomer without any per-display state to inherit: one
  // uniform covers every display the frame draws, this one included. Asserting
  // the key is present is what makes that more than a re-read of `view.alpha`.
  expect(view.alpha).toBe(0.5)
  expect(view.dotplotRenderState.alpha).toBe(0.5)
  expect(view.dotplotRenderState.displayKeys).toContain(added.displayKey)
  // and it is a uniform, not a byte, on this display too
  expect(added.geometry.colors[0]! >>> 24).toBe(255)
}, 45000)

// Two alignment files drawn into one plot used to be indistinguishable — same
// mode, same black points. colorBy:'track' is what tells them apart, and the
// palette is assigned by the view so a color pinned on one shifts what the
// other can automatically take.
async function twoOverlaidTracks() {
  const { rootModel } = await getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const view = await rootModel.session!.launchView('DotplotView', {
    views: [{ assembly: 'peach' }, { assembly: 'grape' }],
    tracks: ['subset', 'peach_grape_small'],
  })
  view.setWidth(800)
  // both displays are awaited all the way to their data even though the color
  // assertions below never read it: an assembly load or a feature fetch still
  // in flight when the last test in the file returns finishes after jest has
  // torn the environment down, and its dynamic `import()` of the adapter
  // resolves to nothing — "require a file after the Jest environment has been
  // torn down", then assembly.ts logging "CLASS is not a constructor" into a
  // dead console. Nothing destroys the root model at the end of a test, so
  // letting the work settle inside the test body is what keeps it off the end
  // of the run.
  await waitFor(
    () => {
      expect(view.tracks.length).toBe(2)
      expect(view.initialized).toBe(true)
      expect(view.dotplotDisplays.length).toBe(2)
      for (const d of view.dotplotDisplays) {
        expect(d.instanceData).toBeDefined()
      }
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
