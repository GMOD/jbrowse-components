import { waitFor } from '@testing-library/react'

import { createTestEnvironment } from './testEnv.ts'

// The twin of the canvas base display's test of the same name. This display
// clicks through a different path — it resolves the region itself before
// fetching — so it has one extra way to end up with nothing to open, and that
// way used to be a bare `if (region)` with no else.

const ctgA = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 10_000,
}

function setup() {
  const { createDisplay } = createTestEnvironment()
  const { display, session, mockRpcCall } = createDisplay()
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

describe('multi-row: a details lookup that finds nothing says so', () => {
  it('notifies when the feature is not found', async () => {
    const { display, session, mockRpcCall } = setup()
    onlyDetails(mockRpcCall, () => ({ feature: undefined }))

    display.selectFeatureById('feat1', 0)

    await waitFor(() => {
      expect(misses(session)).toHaveLength(1)
    })
  })

  it('notifies when the clicked region is no longer loaded', async () => {
    const { display, session } = setup()

    display.selectFeatureById('feat1', 7)

    await waitFor(() => {
      expect(misses(session)).toHaveLength(1)
    })
  })

  it('says nothing when the feature is found', async () => {
    const { display, session, mockRpcCall } = setup()
    onlyDetails(mockRpcCall, () => ({
      feature: { uniqueId: 'feat1', refName: 'ctgA', start: 10, end: 20 },
    }))

    display.selectFeatureById('feat1', 0)

    await waitFor(() => {
      expect(mockRpcCall).toHaveBeenCalled()
    })
    expect(misses(session)).toHaveLength(0)
  })

  it('does not double-report a failed lookup', async () => {
    const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { display, session, mockRpcCall } = setup()
    onlyDetails(mockRpcCall, () => {
      throw new Error('worker exploded')
    })

    display.selectFeatureById('feat1', 0)

    await waitFor(() => {
      expect(
        session.notifications.some(n => n.message.includes('worker exploded')),
      ).toBe(true)
    })
    expect(misses(session)).toHaveLength(0)
    expect(`${reported.mock.calls[0]?.[0]}`).toContain('worker exploded')
    reported.mockRestore()
  })
})
