/* eslint-disable react-refresh/only-export-components */
import React from 'react'

import { render, waitFor } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { LocalFile, GenericFilehandle } from 'generic-filehandle'
import rangeParser from 'range-parser'
import { QueryParamProvider } from 'use-query-params'
import { WindowHistoryAdapter } from 'use-query-params/adapters/window'
import { Image, createCanvas } from 'canvas'

// jbrowse
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import PluginManager from '@jbrowse/core/PluginManager'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import JBrowseWithoutQueryParamProvider from '../components/JBrowse'
import JBrowseRootModelFactory from '../rootModel/rootModel'
import configSnapshot from '../../test_data/volvox/config.json'
import corePlugins from '../corePlugins'
import sessionModelFactory from '../sessionModel'

type LGV = LinearGenomeViewModel

jest.mock('../makeWorkerInstance', () => () => {})

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPluginManager(initialState?: any, adminMode = true) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()

  const rootModel = JBrowseRootModelFactory({
    pluginManager,
    sessionModelFactory,
    adminMode,
  }).create(
    {
      jbrowse: initialState || configSnapshot,
    },
    { pluginManager },
  )

  rootModel.setDefaultSession()
  pluginManager.setRootModel(rootModel)
  pluginManager.configure()
  return pluginManager
}

export function generateReadBuffer(getFile: (s: string) => GenericFilehandle) {
  return async (request: Request) => {
    try {
      const file = getFile(request.url)
      const maxRangeRequest = 10000000 // kind of arbitrary, part of the rangeParser
      const r = request.headers.get('range')
      if (r) {
        const range = rangeParser(maxRangeRequest, r)
        if (range === -2 || range === -1) {
          throw new Error(`Error parsing range "${r}"`)
        }
        const { start, end } = range[0]
        const len = end - start + 1
        const buf = Buffer.alloc(len)
        const { bytesRead } = await file.read(buf, 0, len, start)
        const stat = await file.stat()
        return new Response(buf.slice(0, bytesRead), {
          status: 206,
          headers: [['content-range', `${start}-${end}/${stat.size}`]],
        })
      }
      const body = await file.readFile()
      return new Response(body, { status: 200 })
    } catch (e) {
      console.error(e)
      return new Response(undefined, { status: 404 })
    }
  }
}

export function setup() {
  expect.extend({ toMatchImageSnapshot })
}

export function canvasToBuffer(canvas: HTMLCanvasElement) {
  return Buffer.from(
    canvas.toDataURL().replace(/^data:image\/\w+;base64,/, ''),
    'base64',
  )
}

export function expectCanvasMatch(
  canvas: HTMLElement,
  failureThreshold = 0.01,
) {
  expect(canvasToBuffer(canvas as HTMLCanvasElement)).toMatchImageSnapshot({
    failureThreshold,
    failureThresholdType: 'percent',
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function JBrowse(props: any) {
  return (
    <QueryParamProvider adapter={WindowHistoryAdapter}>
      <JBrowseWithoutQueryParamProvider {...props} />
    </QueryParamProvider>
  )
}

export const hts = (str: string) => 'htsTrackEntry-Tracks,' + str
export const pc = (str: string) => `prerendered_canvas_${str}_done`
export const pv = (str: string) => pc(`{volvox}ctgA:${str}`)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createView(args?: any, adminMode?: boolean) {
  const ret = createViewNoWait(args, adminMode)
  const { view } = ret
  if (view && 'initialized' in view) {
    await waitFor(() => expect(view.initialized).toBe(true), { timeout: 30000 })
  }
  return ret
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createViewNoWait(args?: any, adminMode?: boolean) {
  const pluginManager = getPluginManager(args, adminMode)
  const rest = render(<JBrowse pluginManager={pluginManager} />)
  const rootModel = pluginManager.rootModel!
  const session = rootModel.session!
  const view = session.views[0] as LGV
  return { view, rootModel, session, ...rest }
}

export function doBeforeEach(
  cb = (str: string) => require.resolve(`../../test_data/volvox/${str}`),
) {
  clearCache()
  clearAdapterCache()

  // @ts-expect-error
  fetch.resetMocks()
  // @ts-expect-error
  fetch.mockResponse(generateReadBuffer(url => new LocalFile(cb(url))))
}

export async function doSetupForImportForm(val?: unknown) {
  const args = await createView(val)
  const { view, findByTestId, getByPlaceholderText, findByPlaceholderText } =
    args

  // clear view takes us to the import form
  view.clearView()

  const autocomplete = await findByTestId(
    'autocomplete',
    {},
    { timeout: 10000 },
  )
  const input = (await findByPlaceholderText(
    'Search for location',
    {},
    { timeout: 10000 },
  )) as HTMLInputElement

  // this will be the input that is obtained after opening the LGV from the
  // import form
  const getInputValue = () =>
    (getByPlaceholderText('Search for location') as HTMLInputElement).value

  autocomplete.focus()
  input.focus()

  return {
    autocomplete,
    input,
    getInputValue,
    ...args,
  }
}

export async function mockConsole(fn: () => Promise<void>) {
  const consoleMock = jest.spyOn(console, 'error').mockImplementation()
  await fn()
  consoleMock.mockRestore()
}

export async function mockConsoleWarn(fn: () => Promise<void>) {
  const consoleMock = jest.spyOn(console, 'warn').mockImplementation()
  await fn()
  consoleMock.mockRestore()
}

export function mockFile404(
  str: string,
  readBuffer: (request: Request) => Promise<Response>,
) {
  // @ts-expect-error
  fetch.mockResponse(async request => {
    if (request.url === str) {
      return { status: 404 }
    }
    return readBuffer(request)
  })
}
