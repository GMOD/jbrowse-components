import { suppressTeardownNoise } from '@jbrowse/display-test-utils'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { act, render, waitFor } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'

import { Loader } from '../components/Loader.tsx'
import {
  APOLLO_SHAPED_ACCOUNT_CONF,
  lifecycleProbe,
} from './apolloShapedPlugin.ts'
import { handleRequest, volvoxGetFile } from './generateReadBuffer.ts'

import type { WebRootModel } from '../rootModel/rootModel.ts'
import type * as ApolloShapedFixture from './apolloShapedPlugin.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

// The plugin has to be registered where a real one is — inside the PluginManager
// this app builds — or the test proves nothing about the host. corePlugins is
// that seam under jest; a runtime plugin would otherwise have to be fetched and
// evaluated from a URL.
jest.mock('../corePlugins.ts', () => {
  const actual = jest.requireActual('../corePlugins.ts')
  const { apolloShapedPlugin: make } = jest.requireActual(
    './apolloShapedPlugin.ts',
  ) as typeof ApolloShapedFixture
  return {
    __esModule: true,
    default: [...actual.default, make()],
  }
})

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  if (`${url}`.includes('plugin-store')) {
    return new Response(JSON.stringify({ plugins: [] }))
  }
  if (`${url}`.includes('jb2=true')) {
    return new Response('{}')
  }
  // the config the app boots from, plus an Apollo-shaped internetAccount. Added
  // here rather than to test_data so the fixture and the entry that constructs
  // it stay in one file.
  if (`${url}`.includes('config_main_thread.json')) {
    const res = await handleRequest(() => volvoxGetFile(`${url}`), args)
    const conf = JSON.parse(await res.text())
    return new Response(
      JSON.stringify({
        ...conf,
        internetAccounts: [APOLLO_SHAPED_ACCOUNT_CONF],
      }),
    )
  }
  return handleRequest(() => volvoxGetFile(`${url}`), args)
})

const delay = { timeout: 20000 }

suppressTeardownNoise()

// The contract jbrowse-plugin-apollo depends on, driven the way Apollo drives it.
//
// #5618 stopped the plugin reload destroying the superseded rootModel, so every
// `beforeDestroy` under it stopped running — Apollo's internet account closes its
// websocket in one, and its session aborts its in-flight fetches in another. The
// entire suite stayed green, because nothing in it was a plugin: the hooks this
// repo writes are ones it could equally have called explicitly, and the tests
// that watched the teardown counted dead-node reads, a metric that detaching and
// never destroying scores perfectly on.
//
// So this asserts the hook, not the tidiness. Its subject is the two extension
// points Apollo registers, over the real Loader, the real PluginManager and the
// real reload.
test('a plugin reload runs the beforeDestroy hooks a plugin registered', async () => {
  const search = '?config=test_data/volvox/config_main_thread.json'
  window.history.replaceState(null, '', `${window.location.pathname}${search}`)

  const { findByText } = render(<Loader />)
  await findByText('Help', {}, delay)
  const oldRoot = window.JBrowseRootModel as WebRootModel

  // the account is constructed by the InternetAccounts mixin's autorun off the
  // config, which is how Apollo's arrives too
  await waitFor(() => {
    expect(oldRoot.internetAccounts).toHaveLength(1)
  }, delay)
  const [account] = lifecycleProbe.internetAccounts
  const [session] = lifecycleProbe.sessions
  expect(account).toBeDefined()
  expect(session).toBeDefined()

  // and it really is holding the things a teardown has to release, or the
  // assertions below would pass against a fixture that never opened anything
  expect(account!.socketOpen).toBe(true)
  expect(account!.listenerAttached).toBe(true)
  expect(session!.aborted).toBe(false)

  await act(async () => {
    oldRoot.reloadPluginManagerCallback(
      JSON.parse(JSON.stringify(oldRoot.jbrowse)) as Record<string, unknown>,
      JSON.parse(JSON.stringify(oldRoot.session)) as Record<string, unknown>,
    )
  })
  await waitFor(() => {
    expect(window.JBrowseRootModel).not.toBe(oldRoot)
  }, delay)

  // The socket first, because it is the symptom that was reported: waiting on
  // it rather than on `isAlive` means a regression fails here, saying the socket
  // is still open, instead of failing on the mechanism that happens to cause it.
  //
  // The destroy is deferred a task past the detach (ADR-069), so these run just
  // after the swap rather than during it.
  await waitFor(() => {
    expect(account!.socketOpen).toBe(false)
  }, delay)
  expect(account!.listenerAttached).toBe(false)
  expect(account!.aborted).toBe(true)
  expect(account!.hookRan).toBe(true)

  // the session half fails independently of the account half — different
  // extension point, different node, and setSession reaches one without the other
  await waitFor(() => {
    expect(session!.hookRan).toBe(true)
  }, delay)
  expect(session!.aborted).toBe(true)

  // and the mechanism behind both, so a future teardown that satisfies the hooks
  // some other way still says out loud that it stopped destroying the root
  expect(isAlive(oldRoot)).toBe(false)

  // the replacement built its own, still live — a teardown that took both down
  // would satisfy every assertion above and leave the user with no websocket.
  // Waited for rather than read straight out: the replacement's account is built
  // by the same config autorun the first one was, and nothing above pins that it
  // has run by now, so reading it directly would fail on the ordering rather than
  // on the contract.
  await waitFor(() => {
    expect(lifecycleProbe.internetAccounts.length).toBeGreaterThan(1)
  }, delay)
  const replacement = lifecycleProbe.internetAccounts.at(-1)
  expect(replacement).not.toBe(account)
  expect(replacement!.socketOpen).toBe(true)
}, 60000)
