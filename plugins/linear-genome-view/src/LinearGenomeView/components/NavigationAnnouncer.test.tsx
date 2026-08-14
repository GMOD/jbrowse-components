import { createTestSession } from '@jbrowse/web/testUtils'
import { act, render, waitFor } from '@testing-library/react'

import NavigationAnnouncer from './NavigationAnnouncer.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const FRAMES = 30
const PX_PER_FRAME = 7
const FRAME_MS = 16

async function setup() {
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
          configuration: {},
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
  const model = session.views[0]
  model.setWidth(800)
  await waitFor(() => {
    expect(model.initialized).toBe(true)
  })
  return model
}

test('the live region is polite and restates where the view is', async () => {
  const model = await setup()
  const { getByRole } = render(<NavigationAnnouncer model={model} />)
  await act(async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 600)
    })
  })

  const region = getByRole('status')
  expect(region.getAttribute('aria-live')).toBe('polite')
  expect(region.textContent).toContain(model.coarseVisibleLocStrings)
})

// The failure mode this guards is not "says too much": a polite live region is
// a QUEUE, so one utterance per animation frame of a drag makes a screen reader
// unusable for as long as the drag lasts and for a while after it. The region
// therefore reads the view's own settled signal (`coarseVisibleLocStrings`,
// written by the 500ms-delayed LGVCoarseDynamicBlocks autorun) rather than the
// per-frame `visibleLocStrings`.
test('a pan does not change the announcement per frame', async () => {
  const model = await setup()
  const { getByRole } = render(<NavigationAnnouncer model={model} />)
  await act(async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 600)
    })
  })
  const region = getByRole('status')
  const before = region.textContent

  // fake timers from here so the pan loop's own wall-clock cost cannot cross the
  // 500ms delay and turn this into a race. The clock still advances a frame at a
  // time, or a shorter delay would pass this too.
  jest.useFakeTimers()
  try {
    for (let i = 0; i < FRAMES; i++) {
      // one act() per frame; batching the loop would collapse 30 frames into a
      // single React render and measure nothing
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        model.horizontalScroll(PX_PER_FRAME)
        jest.advanceTimersByTime(FRAME_MS)
      })
    }
    // the pan is deliberately shorter than the delay (30 * 16ms = 480ms), so
    // nothing has been said yet even though the view has plainly moved
    expect(model.visibleLocStrings).not.toBe(model.coarseVisibleLocStrings)
    expect(region.textContent).toBe(before)

    // ...and once it settles, once
    await act(async () => {
      jest.advanceTimersByTime(600)
    })
    expect(region.textContent).not.toBe(before)
    expect(region.textContent).toContain(model.visibleLocStrings)
  } finally {
    jest.useRealTimers()
  }
})
