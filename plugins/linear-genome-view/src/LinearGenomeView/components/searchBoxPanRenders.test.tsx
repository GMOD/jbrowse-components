import '@testing-library/jest-dom'

import { createTestSession } from '@jbrowse/web/testUtils'
import { act, render, waitFor } from '@testing-library/react'

import SearchBox from './SearchBox.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// Counts SearchBox renders without instrumenting SearchBox: RefNameAutocomplete
// is its only child and gets fresh inline props (onSelect, fetchResults) on
// every render, so a stub standing in for it cannot be bailed out of, and its
// render count is SearchBox's.
const mockCount = { renders: 0 }
jest.mock('@jbrowse/core/ui', () => ({
  ...jest.requireActual('@jbrowse/core/ui'),
  RefNameAutocomplete: () => {
    mockCount.renders++
    return null
  },
}))

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

// The location box shows coarseVisibleLocStrings, which only the 500ms-delayed
// LGVCoarseDynamicBlocks autorun writes, so a pan must not reach it per frame —
// the box is one of the few observers left on the header during a gesture, and
// re-rendering it drags an MUI Autocomplete along with it.
test('a pan does not re-render the location box per frame', async () => {
  const model = await setup()
  render(<SearchBox model={model} />)
  await act(async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 600)
    })
  })

  // fake timers from here so the pan loop's own wall-clock cost cannot cross
  // the 500ms delay and turn the counts below into a race. The clock still has
  // to advance a frame at a time, or a shorter delay would pass this too: every
  // frame's timer would sit unfired until the advance after the loop, and one
  // coalesced render is exactly what a working debounce looks like.
  jest.useFakeTimers()
  try {
    mockCount.renders = 0
    for (let i = 0; i < FRAMES; i++) {
      // one act() per frame; batching the whole loop into one would collapse 30
      // frames into a single React render and measure nothing
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        model.horizontalScroll(PX_PER_FRAME)
        jest.advanceTimersByTime(FRAME_MS)
      })
    }
    // the pan is deliberately shorter than the delay (30 * 16ms = 480ms), so a
    // debounced box has not drawn yet
    expect(mockCount.renders).toBe(0)

    await act(async () => {
      jest.advanceTimersByTime(600)
    })
    expect(mockCount.renders).toBe(1)
    expect(model.coarseVisibleLocStrings).toBe(model.visibleLocStrings)
  } finally {
    jest.useRealTimers()
  }
})
