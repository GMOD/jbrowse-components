import { createTestSession } from '@jbrowse/web/testUtils'
import { waitFor } from '@testing-library/react'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// A view collapsed to its ruler unmounts every track, so a display launched
// into it (or whose canvas the collapse tore down) has no canvas to paint.
// Its phase used to wait on that paint forever, parking the app's readiness
// marker at `loading` until the view was expanded.
async function setup({ settle = true } = {}) {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
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
            end: 1000,
            seq: 'A'.repeat(1000),
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
  await view.launchTrack('genes')
  const display = view.tracks[0].displays[0]
  if (settle) {
    await waitFor(() => {
      expect(display.isLoadingOrCanceled).toBe(false)
      expect(display.phaseViewportCurrent).toBe(true)
    })
  }
  return { view, display }
}

test('a collapsed view excuses the paint of a display it does not render', async () => {
  const { view, display } = await setup()
  expect(display.canvasDrawn).toBe(false)
  expect(display.displayPhase).toBe('loading')

  view.setScalebarOnly(true)
  expect(display.displayPhase).toBe('ready')

  view.setScalebarOnly(false)
  expect(display.displayPhase).toBe('loading')
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
