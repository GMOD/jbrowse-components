/* eslint-disable react-refresh/only-export-components */
import React from 'react'

import { Buffer } from 'buffer'

import PluginManager from '@jbrowse/core/PluginManager'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import DefaultMenu from '@jbrowse/core/ui/Menu'
import DefaultMenuButton from '@jbrowse/core/ui/MenuButton'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { render, waitFor } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'
import { LocalFile } from 'generic-filehandle'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import rangeParser from 'range-parser'
import { QueryParamProvider } from 'use-query-params'
import { WindowHistoryAdapter } from 'use-query-params/adapters/window'
import { expect, vi } from 'vitest'


import configSnapshot from '../../test_data/volvox/config.json'
import JBrowseWithoutQueryParamProvider from '../components/JBrowse'
import corePlugins from '../corePlugins'
import JBrowseRootModelFactory from '../rootModel/rootModel'
import sessionModelFactory from '../sessionModel'

import type { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { GenericFilehandle } from 'generic-filehandle'

type LGV = LinearGenomeViewModel

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

export function getPluginManager(
  initialState?: Record<string, unknown>,
  adminMode = true,
) {
  const pluginManager = new PluginManager(
    corePlugins.map(P => new P()),
  ).createPluggableElements()

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
  return { pluginManager, rootModel }
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
        const { start, end } = range[0]!
        const len = end - start + 1
        const buf = await file.read(len, start)
        const stat = await file.stat()
        return new Response(buf, {
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

export function JBrowse(props: any) {
  return (
    <QueryParamProvider adapter={WindowHistoryAdapter}>
      <JBrowseWithoutQueryParamProvider {...props} />
    </QueryParamProvider>
  )
}

export const hts = (str: string) => `htsTrackEntry-Tracks,${str}`
export const pc = (str: string) => `prerendered_canvas_${str}_done`
export const pv = (str: string) => pc(`{volvox}ctgA:${str}`)
vi.mock('file-saver', () => {
  return {
    saveAs: vi.fn(),
  }
})
vi.mock('@jbrowse/core/util/useMeasure', () => {
  return {
    default: () => {
      return [{ current: undefined }, { width: 808 }] as const
    },
  }
})

vi.mock('@jbrowse/core/ReExports', () => {
  return {
    default: () => {
      return {}
    },
  }
})
vi.mock('@jbrowse/core/ui/CascadingMenu', () => {
  return {
    default: DefaultMenu,
  }
})
vi.mock('@jbrowse/core/ui/CascadingMenuButton', () => {
  return {
    default: DefaultMenuButton,
  }
})
export async function createView(args?: any, adminMode?: boolean) {
  const ret = createViewNoWait(args, adminMode)
  const { view } = ret
  if ('initialized' in view) {
    await waitFor(
      () => {
        expect(view.initialized).toBe(true)
      },
      { timeout: 30000 },
    )
  }
  return ret
}
interface Results extends ReturnType<typeof render> {
  view: LGV
  session: AbstractSessionModel
  rootModel: AppRootModel
}
export function createViewNoWait(args?: any, adminMode?: boolean): Results {
  const { pluginManager, rootModel } = getPluginManager(args, adminMode)
  const rest = render(<JBrowse pluginManager={pluginManager} />)
  const session = rootModel.session! as AbstractSessionModel
  const view = session.views[0] as LGV
  return { view, rootModel, session, ...rest }
}

// @ts-expect-error
global.jest = true

export function doBeforeEach(
  cb = (str: string) => require.resolve(`../../test_data/volvox/${str}`),
) {
  clearCache()
  clearAdapterCache()
  global.fetch = vi
    .fn()
    .mockImplementation(generateReadBuffer(url => new LocalFile(cb(url))))
}
interface Results2 extends Results {
  autocomplete: HTMLElement
  input: HTMLElement
  getInputValue: () => string
}
export async function doSetupForImportForm(val?: unknown): Promise<Results2> {
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
  const consoleMock = vi.spyOn(console, 'error').mockImplementation(() => {})
  await fn()
  consoleMock.mockRestore()
}

export async function mockConsoleWarn(fn: () => Promise<void>) {
  const consoleMock = vi.spyOn(console, 'warn').mockImplementation(() => {})
  await fn()
  consoleMock.mockRestore()
}

export function mockFile404(
  str: string,
  readBuffer: (request: string) => Promise<Response>,
) {
  global.fetch = vi
    .fn()
    .mockImplementation(async request =>
      request === str ? { status: 404 } : readBuffer(request),
    )
}
