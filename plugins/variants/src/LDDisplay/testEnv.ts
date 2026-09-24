import { waitFor } from '@testing-library/react'

import { createDisplayTestEnvironment } from '../shared/testEnv.ts'
import ldDisplayConfigSchema from './configSchemaLDTrack.ts'
import stateModelFactory from './model.ts'

import type { LDDisplayModel } from './model.ts'

export function createTestEnvironment() {
  const configSchema = ldDisplayConfigSchema()
  return createDisplayTestEnvironment<LDDisplayModel>({
    trackType: 'LDTrack',
    displayName: 'LDTrackDisplay',
    configSchema,
    stateModel: stateModelFactory(configSchema),
  })
}

/**
 * Wait for the installed fetch autorun to answer what is on screen: one more
 * RPC than has been made so far, and then its commit.
 */
export async function awaitFetch(
  mockRpcCall: jest.Mock,
  display: { isLoading: boolean },
) {
  const before = mockRpcCall.mock.calls.length
  await waitFor(
    () => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(before)
    },
    { timeout: 3000 },
  )
  await waitFor(() => {
    expect(display.isLoading).toBe(false)
  })
}
