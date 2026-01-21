import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { act, render, waitFor } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'
import { LocalFile } from 'generic-filehandle2'

import { handleRequest } from './generateReadBuffer.ts'
import { App } from './loaderUtil.tsx'

import type { WebRootModel } from '../rootModel/rootModel.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// @ts-ignore
global.nodeImage = Image
// @ts-ignore
global.nodeCreateCanvas = createCanvas

const getFile = (url: string) =>
  new LocalFile(
    require.resolve(`../../${url.replace(/http:\/\/localhost\//, '')}`),
  )

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  if (/plugin-store/.exec(`${url}`)) {
    return new Response(JSON.stringify({ plugins: [] }))
  }
  if (`${url}`.includes('jb2=true')) {
    return new Response('{}')
  }
  return handleRequest(() => getFile(`${url}`), args)
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  // @ts-expect-error
  delete window.JBrowseRootModel
})

const delay = { timeout: 20000 }

// This test exercises the real Loader.tsx component's reloadPluginManagerCallback
// by accessing window.JBrowseRootModel (exposed by JBrowse.tsx) and calling
// the callback directly. This verifies the Apollo workflow where:
// 1. Session is saved via getSnapshot
// 2. reloadPluginManagerCallback is called with new config and saved session
// 3. The Loader creates a new SessionLoader and pluginManager
// 4. Session is correctly restored
test('Loader.tsx reloadPluginManagerCallback restores session correctly', async () => {
  const { findByText } = render(
    <App search="?config=test_data/volvox/config_main_thread.json" />,
  )

  // Wait for initial load
  await findByText('Help', {}, delay)

  // Access the rootModel exposed by JBrowse.tsx
  // @ts-expect-error
  const rootModel = window.JBrowseRootModel as WebRootModel

  expect(rootModel).toBeDefined()
  expect(rootModel.session).toBeDefined()

  // Modify the session name to verify it gets preserved
  rootModel.session!.setName('Modified Session For Test')
  expect(rootModel.session!.name).toBe('Modified Session For Test')

  // Save the session snapshot (what Apollo does)
  const savedSessionSnapshot = getSnapshot(rootModel.session)
  const configSnapshot = getSnapshot(rootModel.jbrowse)

  // Call reloadPluginManagerCallback (what Apollo does after fetching new config)
  await act(async () => {
    rootModel.reloadPluginManagerCallback(
      configSnapshot as Record<string, unknown>,
      savedSessionSnapshot as Record<string, unknown>,
    )
  })

  // Wait for the new session to be created
  await waitFor(
    () => {
      // @ts-expect-error
      const newRootModel = window.JBrowseRootModel as WebRootModel
      // The rootModel reference changes after reload
      expect(newRootModel).toBeDefined()
      expect(newRootModel.session).toBeDefined()
      // Session name should be preserved from the saved snapshot
      expect(newRootModel.session!.name).toBe('Modified Session For Test')
    },
    { timeout: 10000 },
  )
}, 30000)
