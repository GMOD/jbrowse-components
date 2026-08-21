import { waitFor } from '@testing-library/react'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

// A click whose details lookup comes back empty used to do nothing at all — no
// widget, no message, no way for the user to tell a missing feature from a dead
// button. These pin the four paths that reach `notifyFeatureDetailsMiss`, and
// the two ways a lookup can come back empty are deliberately BOTH covered:
// `{ feature: undefined }` is the adapter answering "not found", while a
// rejected call is already reported by `fetchCanvasFeatureDetails` itself and
// must not be reported a second time here.

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

const gene = makeFlatbushItem({
  featureId: 'EDEN',
  type: 'gene',
  name: 'EDEN',
  startBp: 1050,
  endBp: 9000,
})

function setup() {
  const { createDisplay } = createTestEnvironment()
  const { display, session, mockRpcCall } = createDisplay()
  display.setRpcData(0, makeFeatureData({ flatbushItems: [gene] }), ctgA)
  display.setLoadedRegion(0, ctgA)
  return { display, session, mockRpcCall }
}

function misses(session: { notifications: { message: string }[] }) {
  return session.notifications.filter(n =>
    n.message.includes('Could not load details'),
  )
}

// Answer only the details method: a blanket `mockResolvedValue` answers the
// per-region FETCH too, and the display stores that reply as region data, where
// the getters reading it throw inside an autorun. Unstubbed methods keep the
// harness default, which never settles.
function onlyDetails(mock: jest.Mock, reply: () => unknown) {
  mock.mockImplementation((_sessionId: string, method: string) => {
    if (method === 'GetCanvasFeatureDetails') {
      return reply()
    }
    return new Promise(() => {})
  })
}

describe('a details lookup that finds nothing says so', () => {
  it('selectFeatureById notifies when the feature is not found', async () => {
    const { display, session, mockRpcCall } = setup()
    onlyDetails(mockRpcCall, () => ({ feature: undefined }))

    display.selectFeatureById('EDEN', undefined, 0)

    await waitFor(() => {
      expect(misses(session)).toHaveLength(1)
    })
    expect(misses(session)[0]!.message).toBe(
      'Could not load details for this feature',
    )
  })

  it('says nothing when the feature is found', async () => {
    const { display, session, mockRpcCall } = setup()
    onlyDetails(mockRpcCall, () => ({
      feature: { uniqueId: 'EDEN', refName: 'ctgA', start: 1050, end: 9000 },
    }))

    display.selectFeatureById('EDEN', undefined, 0)

    // the widget opening is what says it worked; assert on the quiet as well,
    // since a notice on every successful click is the obvious over-correction
    await waitFor(() => {
      expect(mockRpcCall).toHaveBeenCalled()
    })
    expect(misses(session)).toHaveLength(0)
  })

  // The fetch catches its own errors and notifies with the reason, so the miss
  // must stay quiet — otherwise one click tells the user off twice, the second
  // time less usefully than the first.
  it('does not double-report a failed lookup', async () => {
    const { display, session, mockRpcCall } = setup()
    onlyDetails(mockRpcCall, () => {
      throw new Error('worker exploded')
    })

    display.selectFeatureById('EDEN', undefined, 0)

    await waitFor(() => {
      expect(
        session.notifications.some(n => n.message.includes('worker exploded')),
      ).toBe(true)
    })
    expect(misses(session)).toHaveLength(0)
  })

  it('a region that is no longer loaded is the same nothing-to-open', async () => {
    const { display, session } = setup()

    // region index 7 was never loaded
    display.selectFeatureById('EDEN', undefined, 7)

    await waitFor(() => {
      expect(misses(session)).toHaveLength(1)
    })
  })
})
