import { isAlive } from '@jbrowse/mobx-state-tree'
import { act, render, waitFor } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'

import { handleRequest, volvoxGetFile } from './generateReadBuffer.ts'
import { App } from './loaderUtil.tsx'
import { suppressTeardownNoise } from './teardownNoise.ts'

import type { WebRootModel } from '../rootModel/rootModel.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  if (`${url}`.includes('plugin-store')) {
    return new Response(JSON.stringify({ plugins: [] }))
  }
  if (`${url}`.includes('jb2=true')) {
    return new Response('{}')
  }
  return handleRequest(() => volvoxGetFile(`${url}`), args)
})

const delay = { timeout: 20000 }

suppressTeardownNoise()

// Switching sessions used to destroy the outgoing one inside setSession, and
// MobX runs an action's pending reactions at the endBatch closing it — so every
// observer over that session got a final run against a node that had died
// mid-action. 19 liveliness reads on this config, across the view, the display,
// the track and the track selector.
//
// The fix is in product-core's BaseRootModel (detach in the action, destroy on a
// later tick) but there is nowhere in product-core to observe it: it takes a
// mounted app with a rendered view and an open track for the reactions to exist
// at all. Hence a jbrowse-web test for a product-core fix.
//
// Every path a user has to a different session goes through setSession: "New
// session", opening a saved one, importing one, and factory reset.
test('switching sessions does not read the session it replaced', async () => {
  const { findByText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json" />,
  )
  await findByText('Help', {}, delay)
  const rootModel = window.JBrowseRootModel as WebRootModel
  const oldSession = rootModel.session

  const deadReads: string[] = []
  const origWarn = console.warn
  const origError = console.error
  const capture = (...args: unknown[]) => {
    const first = args[0]
    const text =
      first instanceof Error ? first.stack || first.message : `${first}`
    if (text.includes('no longer part of a state tree')) {
      deadReads.push(text.split('\n')[0]!)
    } else {
      origWarn(...(args as []))
    }
  }
  console.warn = capture
  console.error = capture
  try {
    await act(async () => {
      rootModel.setDefaultSession()
    })
  } finally {
    console.warn = origWarn
    console.error = origError
  }

  // Scoped to the swap itself — the action and the reaction flush that closes
  // it — and deliberately not to the deferred teardown that follows.
  //
  // That window is the one that matters and the one that is deterministic:
  // it is where components are still mounted over the outgoing session, so a
  // read there is a read of a node something is rendering, and on an
  // unmaterialized array child it is the throw that takes the page down rather
  // than a warning. Detaching empties it, every run.
  //
  // Destroying the detached tree afterwards can still produce a few, because
  // killing an MST tree invalidates computeds inside it that something is
  // observing, and MobX recomputes them against the dying nodes. It measured
  // 0-3 across runs. Asserting zero there would be a flaky test making a
  // promise this design does not keep; see agent-docs/TODO.md.
  expect(deadReads).toEqual([])
  expect(rootModel.session).toBeDefined()
  expect(rootModel.session).not.toBe(oldSession)

  // and it really is destroyed, not merely detached and forgotten. This is the
  // half that keeps the fix honest: `beforeDestroy` is a plugin-facing contract
  // (jbrowse-plugin-apollo aborts its in-flight fetches there) and core's
  // BaseTrackModel releases the rpcSessionId claim that lets CoreFreeResources
  // evict the parsed adapter from the worker. Detaching and never destroying
  // would zero the count above while leaking both.
  await waitFor(() => {
    expect(isAlive(oldSession)).toBe(false)
  }, delay)
}, 60000)
