import { waitFor } from '@testing-library/react'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

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
  return { display, session, mockRpcCall }
}

function misses(session: { notifications: { message: string }[] }) {
  return session.notifications.filter(n =>
    n.message.includes('Could not load details'),
  )
}

// Answers only the details method: a blanket `mockResolvedValue` answers the
// per-region fetch too, and the display stores that reply as region data.
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

    display.selectFeatureById('EDEN', undefined, 0)

    await waitFor(() => {
      expect(
        session.notifications.some(n => n.message.includes('worker exploded')),
      ).toBe(true)
    })
    expect(misses(session)).toHaveLength(0)
    expect(`${reported.mock.calls[0]?.[0]}`).toContain('worker exploded')
    reported.mockRestore()
  })

  it('a region that is no longer loaded is the same nothing-to-open', async () => {
    const { display, session } = setup()

    display.selectFeatureById('EDEN', undefined, 7)

    await waitFor(() => {
      expect(misses(session)).toHaveLength(1)
    })
  })
})
