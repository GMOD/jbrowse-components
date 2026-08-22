import { AppReadyMarker } from '@jbrowse/app-core'
import { render, waitFor } from '@testing-library/react'

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

// `[data-app-phase="ready"]` is the whole readiness contract, and the synteny
// view is the one that could satisfy it while a ribbon was still fetching: its
// tracks hang off `levels`, not off `view.tracks`, so a walk of the view's own
// track list found nothing that could be loading. The level is published as a
// `trackContainer` for that reason, and its displays publish `displayPhase`.
//
// Against the REAL marker over a REAL session, because each half of the seam is
// green on its own with the other half missing: app-core's unit test proves the
// walk reads `trackContainers`, and the plugin proves a level is one — neither
// notices if the display never grew a phase.
test('the app marker counts a synteny level a walk of view.tracks cannot reach', async () => {
  const { rootModel } = await getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = (await session.launchView('LinearSyntenyView', {
    init: {
      views: [
        { loc: 'Pp01:28,845,211..28,845,272', assembly: 'peach' },
        { loc: 'chr1:316,306..316,364', assembly: 'grape' },
      ],
      tracks: [['subset']],
    },
  })) as {
    setWidth: (n: number) => void
    levels: {
      markCanvasDrawn: () => void
      linearSyntenyDisplays: { displayPhase: string }[]
    }[]
    tracks?: unknown[]
    trackContainers: { tracks: unknown[] }[]
    beginAutoDiagonalize: (arg: boolean) => void
    finishAutoDiagonalize: () => void
  }
  view.setWidth(800)

  const marker = render(<AppReadyMarker session={session} />).getByTestId(
    'app-ready-marker',
  )
  const appPhase = async (expected: string) => {
    await waitFor(() => {
      expect(marker.dataset.appPhase).toBe(expected)
    })
  }

  await waitFor(
    () => {
      expect(view.levels[0]?.linearSyntenyDisplays.length).toBe(1)
    },
    { timeout: 30000 },
  )
  const display = view.levels[0]!.linearSyntenyDisplays[0]!

  // the shape of the hole: the view has no track list of its own, so the ribbon
  // is reachable only through the container it publishes
  expect(view.tracks).toBeUndefined()
  expect(view.trackContainers[0]!.tracks).toHaveLength(1)

  // jsdom mounts no canvas, so the level's `painted` never flips on its own —
  // and it belongs in the phase, because a fetch that has landed over a canvas
  // React has not committed is the blank-frame race the marker exists to close.
  // The settle-gate tests stand a level up the same way.
  view.levels[0]!.markCanvasDrawn()

  await waitFor(
    () => {
      expect(display.displayPhase).toBe('ready')
    },
    { timeout: 30000 },
  )
  await appPhase('ready')

  // A reorder this init asked for that has not landed means what is on screen is
  // the pre-reorder hairball. The ribbon says so through its phase, and the
  // marker has to hear it — reached through the level, which is the hop that did
  // not exist before.
  view.beginAutoDiagonalize(true)
  expect(display.displayPhase).toBe('loading')
  await appPhase('loading')

  view.finishAutoDiagonalize()
  await appPhase('ready')
}, 60000)

// The dotplot half. Its tracks ARE on the view, so the marker already walked to
// them — what it found there was a display with no `displayPhase`, which reads
// as finished. Same conjunction, reached by the ordinary arm.
test('the app marker counts a dotplot display', async () => {
  const { rootModel } = await getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const view = (await session.launchView('DotplotView', {
    init: {
      views: [{ assembly: 'peach' }, { assembly: 'grape' }],
      tracks: ['subset'],
    },
  })) as {
    setWidth: (n: number) => void
    markCanvasDrawn: () => void
    dotplotDisplays: { displayPhase: string }[]
    beginAutoDiagonalize: (arg: boolean) => void
    finishAutoDiagonalize: () => void
  }
  view.setWidth(800)

  const marker = render(<AppReadyMarker session={session} />).getByTestId(
    'app-ready-marker',
  )
  const appPhase = async (expected: string) => {
    await waitFor(() => {
      expect(marker.dataset.appPhase).toBe(expected)
    })
  }

  await waitFor(
    () => {
      expect(view.dotplotDisplays.length).toBe(1)
    },
    { timeout: 30000 },
  )
  const display = view.dotplotDisplays[0]!
  // jsdom mounts no canvas; see the note in the synteny test above
  view.markCanvasDrawn()

  await waitFor(
    () => {
      expect(display.displayPhase).toBe('ready')
    },
    { timeout: 30000 },
  )
  await appPhase('ready')

  view.beginAutoDiagonalize(true)
  expect(display.displayPhase).toBe('loading')
  await appPhase('loading')

  view.finishAutoDiagonalize()
  await appPhase('ready')
}, 60000)

// The trap this design had to avoid: an import form has drawn no canvas, so
// `settled` is false and stays false. A view-level `settled === false` term in
// the marker would park the whole app at `loading` forever on every import-form
// figure, of which the figure corpus has several. Asking the DISPLAYS instead
// means an import form contributes nothing, because it has none.
//
// The marker still reads `loading` on this session, off the `initialized ===
// false` term it has always had for a view with no assembly. That is a separate
// question from this change and is left alone.
test('a comparative import form contributes no loading display', async () => {
  const { rootModel } = await getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  const session = rootModel.session!
  const dotplot = (await session.launchView('DotplotView', {})) as {
    setWidth: (n: number) => void
    showImportForm: boolean
    settled: boolean
    displayPhase: string
    dotplotDisplays: unknown[]
  }
  const synteny = (await session.launchView('LinearSyntenyView', {})) as {
    setWidth: (n: number) => void
    showImportForm: boolean
    trackContainers: { tracks: unknown[] }[]
  }
  dotplot.setWidth(800)
  synteny.setWidth(800)

  expect(dotplot.showImportForm).toBe(true)
  expect(synteny.showImportForm).toBe(true)
  // the flag a naive view-level term would have read, and it never flips
  expect(dotplot.settled).toBe(false)
  // ...while the question the marker actually asks has no unfinished answer
  expect(dotplot.dotplotDisplays).toHaveLength(0)
  expect(dotplot.displayPhase).toBe('ready')
  expect(synteny.trackContainers).toHaveLength(0)
}, 60000)
