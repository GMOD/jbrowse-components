/* eslint-disable react-refresh/only-export-components */
import fs from 'fs'
import path from 'path'

import PluginManager from '@jbrowse/core/PluginManager'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { saveAs } from '@jbrowse/core/util'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'
import { LocalFile } from 'generic-filehandle2'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

import { generateReadBuffer } from './generateReadBuffer.ts'
import configSnapshot from '../../test_data/volvox/config.json' with { type: 'json' }
import corePlugins from '../corePlugins.ts'
import JBrowse from './TestingJBrowse.tsx'
import JBrowseRootModelFactory from '../rootModel/rootModel.ts'
import sessionModelFactory from '../sessionModel/index.ts'

import type { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { RenderResult } from '@testing-library/react'

type LGV = LinearGenomeViewModel

jest.mock('../makeWorkerInstance', () => () => {})

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
      jbrowse: initialState ?? configSnapshot,
    },
    { pluginManager },
  )

  rootModel.setDefaultSession()
  pluginManager.setRootModel(rootModel)
  pluginManager.configure()
  return { pluginManager, rootModel }
}

export function setup() {
  expect.extend({ toMatchImageSnapshot })
}

export function canvasToBuffer(canvas: HTMLCanvasElement) {
  const { width, height } = canvas
  const src = canvas.getContext('2d')!.getImageData(0, 0, width, height)
  const flat = createCanvas(width, height)
  const flatCtx = flat.getContext('2d')
  flatCtx.fillStyle = '#ffffff'
  flatCtx.fillRect(0, 0, width, height)
  const dst = flatCtx.getImageData(0, 0, width, height)
  const s = src.data
  const d = dst.data
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3]! / 255
    d[i] = Math.round(s[i]! * a + 255 * (1 - a))
    d[i + 1] = Math.round(s[i + 1]! * a + 255 * (1 - a))
    d[i + 2] = Math.round(s[i + 2]! * a + 255 * (1 - a))
    d[i + 3] = 255
  }
  flatCtx.putImageData(dst, 0, 0)
  return flat.toBuffer()
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

export const hts = (str: string) => `htsTrackEntry-Tracks,${str}`

export function findCanvasIn(container: HTMLElement) {
  const canvas = container.querySelector('canvas')
  if (!canvas) {
    throw new Error('No canvas found in container')
  }
  return canvas
}

/** Wait for a display to finish rendering and return its canvas element. */
export async function waitForRenderedCanvas(
  findAllByTestId: (
    matcher: RegExp,
    options?: object,
    waitOptions?: object,
  ) => Promise<HTMLElement[]>,
  timeout = 20000,
) {
  const displays = await findAllByTestId(/^display-.*-done$/, {}, { timeout })
  return findCanvasIn(displays[0]!)
}

// Convert old block key format {asm}ref:start..end-idx → asm:ref:start0:end:idx
const convertBlockKey = (str: string) =>
  str.replace(
    /\{(\w+)\}(\w+):(\d+)\.\.(\d+)-(\d+)/,
    (_, asm, ref, s, e, i) => `${asm}:${ref}:${Number(s) - 1}:${e}:${i}`,
  )
export const pc = (str: string) =>
  `prerendered_canvas_${convertBlockKey(str)}_done`
export const pv = (str: string) => pc(`{volvox}ctgA:${str}`)

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

export function doBeforeEach(
  cb = (str: string) =>
    require.resolve(
      `../../test_data/volvox/${str.replace('http://localhost:3000/test_data/volvox/', '')}`,
    ),
) {
  clearCache()
  clearAdapterCache()

  // @ts-expect-error
  fetch.resetMocks()
  // @ts-expect-error
  fetch.mockResponse(generateReadBuffer(url => new LocalFile(cb(url))))
}
interface Results2 extends Results {
  autocomplete: HTMLElement
  input: HTMLInputElement
  getInputValue: () => string
}
export async function doSetupForImportForm(val?: unknown): Promise<Results2> {
  const args = await createView(val)
  const { view, findByTestId, getByPlaceholderText, findByPlaceholderText } =
    args

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

  const getInputValue = () =>
    (getByPlaceholderText('Search for location') as HTMLInputElement).value

  autocomplete.focus()
  input.focus()

  return {
    autocomplete,
    getInputValue,
    input,
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
    const matches = request.url.includes(str)
    return matches ? { status: 404 } : readBuffer(request)
  })
}

export async function exportAndVerifySvg({
  findByTestId,
  findByText,
  filename,
  delay,
  findAllByText,
  beforeSubmit,
}: Pick<RenderResult, 'findByTestId' | 'findByText'> & {
  filename: string
  delay?: { timeout: number }
  findAllByText?: RenderResult['findAllByText']
  beforeSubmit?: () => Promise<void>
}) {
  const actualDelay = delay ?? { timeout: 40000 }
  const opts = [{}, actualDelay]
  fireEvent.click(await findByTestId('view_menu_icon', ...opts))

  if (findAllByText) {
    fireEvent.click((await findAllByText('Export SVG'))[0]!)
  } else {
    fireEvent.click(await findByText('Export SVG', ...opts))
  }

  await beforeSubmit?.()

  fireEvent.click(await findByText('Submit', ...opts))

  await waitFor(() => {
    expect(saveAs).toHaveBeenCalled()
  }, actualDelay)

  // @ts-expect-error

  const svg = saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/${filename}_snapshot.svg`, svg)
  expect(svg).toMatchSnapshot()
  return svg
}

export async function testFileReload(config: {
  failingFile: string
  readBuffer: (request: Request) => Promise<Response>
  trackId: string
  viewLocation: [number, number]
  expectedCanvas: string | RegExp
  timeout?: number
}) {
  const delay = { timeout: config.timeout ?? 30000 }
  const opts = [{}, delay]

  await mockConsole(async () => {
    mockFile404(config.failingFile, config.readBuffer)
    const { view, findByTestId, findAllByTestId, findAllByText } =
      await createView()
    view.setNewView(config.viewLocation[0], config.viewLocation[1])
    fireEvent.click(await findByTestId(hts(config.trackId), ...opts))
    await findAllByText(/HTTP 404/, ...opts)

    // @ts-expect-error
    fetch.mockResponse(config.readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0]!)

    const displayEl =
      typeof config.expectedCanvas === 'string'
        ? await findByTestId(config.expectedCanvas, ...opts)
        : (await findAllByTestId(config.expectedCanvas, ...opts))[0]!
    const canvas = displayEl.querySelector('canvas') ?? displayEl
    expectCanvasMatch(canvas)
  })
}

export async function openSpreadsheetView({
  user,
  screen,
  fileUrl,
  timeout,
}: {
  user: any
  screen: any
  fileUrl: string
  timeout?: number
}) {
  const delay = { timeout: timeout ?? 50000 }
  const opts = [{}, delay]
  const { session } = await createView()

  await user.click(await screen.findByText('File'))
  await user.click(await screen.findByText('Add'))
  await user.click(await screen.findByText('Spreadsheet view'))

  fireEvent.change(await screen.findByTestId('urlInput', ...opts), {
    target: { value: fileUrl },
  })

  await waitFor(() => {
    expect(screen.getByTestId('open_spreadsheet')).not.toBeDisabled()
  }, delay)

  await user.click(await screen.findByTestId('open_spreadsheet'))
  return { session }
}

export async function openViewWithFileInput({
  menuPath,
  fileUrl,
  timeout,
}: {
  menuPath: string[]
  fileUrl: string
  timeout?: number
}) {
  const delay = { timeout: timeout ?? 40000 }
  const result = await createView()
  const { findByTestId, getByTestId, findByText } = result

  for (const item of menuPath) {
    fireEvent.click(await findByText(item))
  }

  fireEvent.change(await findByTestId('urlInput', {}, delay), {
    target: { value: fileUrl },
  })

  await waitFor(() => {
    expect(getByTestId('open_spreadsheet').closest('button')).not.toBeDisabled()
  }, delay)

  fireEvent.click(await findByTestId('open_spreadsheet'))
  return result
}

export { default as JBrowse } from './TestingJBrowse.tsx'

export { generateReadBuffer } from './generateReadBuffer.ts'
