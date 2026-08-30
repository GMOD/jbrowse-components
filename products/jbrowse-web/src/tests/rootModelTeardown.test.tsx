import '../components/enableReactRenderLogging.ts'

import { getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'
import { act, render, waitFor } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'

// deliberately NOT ./loaderUtil.tsx: this test is about the real disposeLoader
import { Loader } from '../components/Loader.tsx'
import { renderLoggedComponents } from '../components/renderLogRecord.ts'
import { handleRequest, volvoxGetFile } from './generateReadBuffer.ts'
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

// The rootModel half of the superseded-loader crash (#5618 fixed the loader
// half). disposePluginManager runs from a React effect cleanup, in the unmount
// side of a passive-effect flush; React's dev-mode render-logging then diffs
// the outgoing props in the mount side of that same flush and walks four
// levels into them, which reaches the rootModel through {pluginManager} and
// the session below it. Destroying synchronously there produced 16 liveliness
// warnings on an ordinary volvox session — and a warning and a crash are the
// same event, decided only by whether the property it lands on happens to be a
// materialized array child.
//
// This asserts on the real teardown, so it needs the real disposeLoader.
// Everything else that mounts the app goes through loaderUtil.tsx.
test('a plugin reload does not read the rootModel it just destroyed', async () => {
  const search = '?config=test_data/volvox/config_main_thread.json'
  window.history.replaceState(null, '', `${window.location.pathname}${search}`)

  const { findByText } = render(<Loader />)
  await findByText('Help', {}, delay)
  const oldRoot = window.JBrowseRootModel as WebRootModel

  const deadReads: string[] = []
  const origWarn = console.warn
  const origError = console.error
  const capture = (...args: unknown[]) => {
    const msg = args.map(a => `${a}`).join(' ')
    if (msg.includes('no longer part of a state tree')) {
      // Bucketed by whether the superseded root is still alive, which is what
      // separates the two windows this path has. While it is alive the only
      // thing that can be reading a dead node is something rendering the
      // outgoing tree — that is the crash window, and it has to be empty. Once
      // the scheduled destroy has run, reads are the teardown's own, on a tree
      // nothing renders; those are the documented residual, not this test's
      // subject.
      if (isAlive(oldRoot)) {
        deadReads.push(msg.split('\n')[0]!)
      }
    } else {
      origWarn(...(args as []))
    }
  }
  console.warn = capture
  console.error = capture
  try {
    await act(async () => {
      oldRoot.reloadPluginManagerCallback(
        getSnapshot(oldRoot.jbrowse) as Record<string, unknown>,
        getSnapshot(oldRoot.session),
      )
    })
    await waitFor(() => {
      expect(window.JBrowseRootModel).not.toBe(oldRoot)
    }, delay)
  } finally {
    console.warn = origWarn
    console.error = origError
  }

  // Scoped to the swap itself, and deliberately not to the deferred teardown
  // that follows — the same scoping sessionSwitchTeardown uses, for the same
  // reason. This window is where React is still holding the outgoing props, so
  // a read here is a read of a node something is rendering, and on an
  // unmaterialized array child it is the throw that took the page down. It is
  // empty, every run.
  expect(deadReads).toEqual([])
  // and React's render-logging really ran, so the assertion above means
  // something (see renderLogRecord)
  expect(renderLoggedComponents().length).toBeGreaterThan(0)

  // Everything reaching outside the tree stopped at detach, not at the destroy
  // below, so nothing of this root's runs in the window between the two.
  expect(oldRoot.detachDisposers).toHaveLength(0)

  // and the root really does die, rather than being detached and forgotten.
  // This is the half that keeps the fix honest: the whole plugin-facing tree
  // hangs off this root, so leaving it alive drops every `beforeDestroy` in it
  // — jbrowse-plugin-apollo closes its websocket in one, and core's
  // BaseTrackModel releases the rpcSessionId claim. #5618 left it alive and
  // Apollo reported the leak.
  //
  // Destroying it is loud, and measurably so: in a real browser this logs ~48
  // liveliness warnings, undiminished by waiting 5s instead of 0 rather than a
  // race with React. Every one is a scalar or reference read on a detached
  // tree nothing renders, no page error and no throw shape. See
  // agent-docs/TODO.md for what still observes it, which is the fixable half.
  await waitFor(() => {
    expect(isAlive(oldRoot)).toBe(false)
  }, delay)
}, 60000)
