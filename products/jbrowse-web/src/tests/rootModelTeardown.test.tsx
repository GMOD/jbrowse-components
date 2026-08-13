import '../components/enableReactRenderLogging.ts'

import { getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'
import { act, render, waitFor } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'

// deliberately NOT ./loaderUtil.tsx: this test is about the real disposeLoader
import { Loader } from '../components/Loader.tsx'
import { renderLoggedComponents } from '../components/renderLogRecord.ts'
import { handleRequest, volvoxGetFile } from './generateReadBuffer.ts'

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
      deadReads.push(msg.split('\n')[0]!)
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

  expect(deadReads).toEqual([])
  // and React's render-logging really ran, so the assertion above means
  // something (see renderLogRecord)
  expect(renderLoggedComponents().length).toBeGreaterThan(0)

  // The superseded root is deliberately left alive — that is the fix, not an
  // oversight, so pin it. What was torn down is everything of its own that
  // reached outside the tree; the tree itself is left for the GC.
  expect(isAlive(oldRoot)).toBe(true)
  expect(oldRoot.detachDisposers).toHaveLength(0)
}, 60000)
