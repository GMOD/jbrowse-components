import { createTestSession } from '@jbrowse/web/testUtils'
import { waitFor } from '@testing-library/react'
import { autorun } from 'mobx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// A view collapsed to its ruler, or a minimized track, unmounts the track's
// canvas, so the display has no canvas to paint. A minimized track also stops
// fetching. Its phase used to wait on both forever, parking the app's readiness
// marker at `loading` until the view was expanded or the track restored.
async function setup({ settle = true, trackId = 'genes' } = {}) {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50000 },
          ],
          tracks: [],
        },
      ],
    },
  }) as any
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 50000,
            seq: 'A'.repeat(50000),
          },
        ],
      },
    },
  })
  session.addSessionTrackConf({
    trackId: 'genes',
    name: 'genes',
    assemblyNames: ['volvox'],
    type: 'FeatureTrack',
    adapter: {
      type: 'FromConfigAdapter',
      features: [{ refName: 'ctgA', uniqueId: 'f1', start: 10, end: 100 }],
    },
  })
  const view = session.views[0]
  view.setWidth(800)
  await waitFor(() => {
    expect(view.initialized).toBe(true)
  })
  await view.launchTrack(trackId)
  const track = view.tracks[0]
  const display = track.displays[0]
  if (settle) {
    await waitFor(() => {
      expect(display.isLoadingOrCanceled).toBe(false)
      expect(display.phaseViewportCurrent).toBe(true)
    })
  }
  return { view, track, display }
}

function observePhase(display: { displayPhase: string }) {
  const seen: string[] = []
  const dispose = autorun(() => {
    seen.push(display.displayPhase)
  })
  return { seen, dispose }
}

test('a collapsed view excuses the paint of a display it does not render', async () => {
  const { view, display } = await setup()
  expect(display.canvasDrawn).toBe(false)
  const { seen, dispose } = observePhase(display)

  view.setScalebarOnly(true)
  view.setScalebarOnly(false)
  dispose()
  expect(seen).toEqual(['loading', 'ready', 'loading'])
})

test('collapsing a painted view stays ready, and expanding waits for the repaint', async () => {
  const { view, display } = await setup()
  display.markCanvasDrawn()
  expect(display.displayPhase).toBe('ready')

  view.setScalebarOnly(true)
  display.stopRenderingBackend()
  expect(display.displayPhase).toBe('ready')

  view.setScalebarOnly(false)
  expect(display.displayPhase).toBe('loading')

  display.markCanvasDrawn()
  expect(display.displayPhase).toBe('ready')
})

test('collapsing mid-fetch still reads loading', async () => {
  const { view, display } = await setup({ settle: false })
  view.setScalebarOnly(true)
  expect(display.isLoadingOrCanceled).toBe(true)
  expect(display.displayPhase).toBe('loading')
})

test('a minimized track is ready, and restoring it waits for the paint', async () => {
  const { track, display } = await setup()
  const { seen, dispose } = observePhase(display)

  track.setMinimized(true)
  track.setMinimized(false)
  dispose()
  expect(seen).toEqual(['loading', 'ready', 'loading'])
})

test('a track minimized after its paint stays ready through a pan it does not fetch', async () => {
  const { view, track, display } = await setup()
  display.markCanvasDrawn()
  expect(display.displayPhase).toBe('ready')

  track.setMinimized(true)
  display.stopRenderingBackend()
  await view.navToLocString('ctgA:40000-40800')
  expect(display.phaseViewportCurrent).toBe(false)
  expect(display.displayPhase).toBe('ready')

  track.setMinimized(false)
  expect(display.displayPhase).toBe('loading')
})

test('a minimized track whose display overrides fetchInert is ready too', async () => {
  const { track, display } = await setup({ trackId: 'ref0' })
  expect(display.canvasDrawn).toBe(false)
  expect(display.displayPhase).toBe('loading')

  track.setMinimized(true)
  expect(display.displayPhase).toBe('ready')
})
