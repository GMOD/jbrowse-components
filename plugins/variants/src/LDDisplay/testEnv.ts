import { types } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { createDisplayTestEnvironment } from '../shared/testEnv.ts'
import ldDisplayConfigSchema from './configSchemaLDTrack.ts'
import sharedModelFactory from './shared.ts'

import type { SharedLDModel } from './shared.ts'

// The shared variant display harness wired for the LD display. `SharedLDModel`
// has no `type` literal of its own (the concrete display adds it), so the
// harness registers it under one.
//
// The production schema, not a hand-built copy of it. The copy here restated
// `height: 400` — the one slot the concrete schema used to add — so it was a
// second declaration of a value only `index.ts` was authoritative for, free to
// drift the moment either moved.
export function createTestEnvironment() {
  const configSchema = ldDisplayConfigSchema()
  return createDisplayTestEnvironment<SharedLDModel>({
    trackType: 'LDTrack',
    displayName: 'LDTrackDisplay',
    configSchema,
    stateModel: sharedModelFactory(configSchema)
      .named('LDTrackDisplay')
      .props({ type: types.literal('LDTrackDisplay') }),
  })
}

/**
 * Wait for the installed fetch autorun to answer what is on screen: one more
 * RPC than has been made so far, and then its commit. The autorun re-runs
 * `delay` after its last run, so this outlasts the debounce rather than
 * driving the phases around it — the gates a fetch runs under are the
 * installed declaration's, and a test that bypassed them was testing a copy.
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
