/* eslint-disable react-refresh/only-export-components */
import fs from 'fs'
import path from 'path'

import PluginManager from '@jbrowse/core/PluginManager'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Image, createCanvas } from 'canvas'
import { saveAs } from 'file-saver-es'
import { LocalFile } from 'generic-filehandle2'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

import { generateReadBuffer } from './generateReadBuffer'
import configSnapshot from '../../test_data/volvox/config.json'
import corePlugins from '../corePlugins'
import JBrowseRootModelFactory from '../rootModel/rootModel'
import sessionModelFactory from '../sessionModel'
import JBrowse from './TestingJBrowse'

import type { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
      jbrowse: initialState || configSnapshot,
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
  // eslint-disable-next-line no-restricted-globals
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

export const hts = (str: string) => `htsTrackEntry-Tracks,${str}`
export const pc = (str: string) => `prerendered_canvas_${str}_done`
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
  fetch.mockResponse(async request =>
    request.url === str ? { status: 404 } : readBuffer(request),
  )
}

export async function exportAndVerifySvg({
  findByTestId,
  findByText,
  filename,
  delay,
  findAllByText,
}: {
  findByTestId: any
  findByText: any
  filename: string
  delay?: { timeout: number }
  findAllByText?: any
}) {
  const actualDelay = delay || { timeout: 40000 }
  const opts = [{}, actualDelay]
  fireEvent.click(await findByTestId('view_menu_icon', ...opts))

  if (findAllByText) {
    fireEvent.click((await findAllByText('Export SVG'))[0])
  } else {
    fireEvent.click(await findByText('Export SVG', ...opts))
  }

  fireEvent.click(await findByText('Submit', ...opts))

  await waitFor(() => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(saveAs).toHaveBeenCalled()
  }, actualDelay)

  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const svg = saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/${filename}_snapshot.svg`, svg)
  expect(svg).toMatchSnapshot()
  return svg
}

export async function testFileReload(config: {
  failingFile: string
  readBuffer: any
  trackId: string
  viewLocation: [number, number]
  expectedCanvas: string | RegExp
  timeout?: number
}) {
  const delay = { timeout: config.timeout || 30000 }
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

    const canvas =
      typeof config.expectedCanvas === 'string'
        ? await findByTestId(config.expectedCanvas, ...opts)
        : (await findAllByTestId(config.expectedCanvas, ...opts))[0]!
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
  const delay = { timeout: timeout || 50000 }
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
  const delay = { timeout: timeout || 40000 }
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

export async function testOpenTrack({
  bpPerPx,
  start,
  trackId,
  canvasLoc,
  timeout = 20000,
}: {
  bpPerPx: number
  start: number
  trackId: string
  canvasLoc: string
  timeout?: number
}) {
  const { view, findByTestId } = await createView()
  view.setNewView(bpPerPx, start)
  fireEvent.click(await findByTestId(hts(trackId), {}, { timeout }))
  expectCanvasMatch(await findByTestId(pv(canvasLoc), {}, { timeout }))
}

export async function testAlignmentModificationsDisplay({
  testDataDir,
  config,
  canvasTestId,
  timeout = 50000,
}: {
  testDataDir: string
  config: any
  canvasTestId: string
  timeout?: number
}) {
  const opts = [{}, { timeout }] as const
  const { findByTestId } = await createView(config)

  const f1 = within(await findByTestId('Blockset-pileup'))
  const f2 = within(await findByTestId('Blockset-snpcoverage'))

  expectCanvasMatch(await f1.findByTestId(canvasTestId, ...opts))
  expectCanvasMatch(await f2.findByTestId(canvasTestId, ...opts))
}

export async function waitForPileupDraw(view: any, timeout = 60000) {
  await waitFor(
    () => {
      expect(view.tracks[0]?.displays[0]?.PileupDisplay?.drawn).toBe(true)
    },
    { timeout },
  )
}

export async function testLinkedReadsDisplay({
  loc,
  track,
  displayMode,
  canvasId,
  timeout = 60000,
}: {
  loc: string
  track: string
  displayMode: 'arc' | 'cloud' | 'stack'
  canvasId: string
  timeout?: number
}) {
  const user = userEvent.setup()
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  const opts = [{}, { timeout }] as const

  await view.navToLocString(loc)
  await user.click(await findByTestId(hts(track), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click(await findByText('Replace lower panel with...'))

  if (displayMode === 'arc') {
    await user.click((await findAllByText('Read arc display'))[0]!)
  } else {
    await user.click((await findAllByText('Linked reads display'))[0]!)
    if (displayMode === 'cloud') {
      await user.click(await findByTestId('track_menu_icon', ...opts))
      await user.click((await findAllByText(/Toggle read cloud/))[0]!)
    }
  }

  await waitForPileupDraw(view, timeout)
  if (displayMode !== 'arc') {
    await findByTestId(canvasId, {}, { timeout })
  }
  await new Promise(res => setTimeout(res, 2000))
  expectCanvasMatch(getByTestId(canvasId))
}

export async function testMultiVariantDisplay({
  displayType,
  phasedMode,
  timeout = 60000,
}: {
  displayType: 'matrix' | 'regular'
  phasedMode?: 'phased'
  timeout?: number
}) {
  const delay = { timeout }
  const opts = [{}, delay] as const
  const displayText =
    displayType === 'matrix'
      ? 'Multi-sample variant display (matrix)'
      : 'Multi-sample variant display (regular)'
  const useAll = displayType === 'regular'

  const { view, findByTestId, findAllByText, findByText, findAllByTestId } =
    await createView()
  await view.navToLocString('ctgA')
  fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))

  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(await findByText(displayText, ...opts))

  if (useAll) {
    await new Promise(res => setTimeout(res, 1000))
  }

  if (phasedMode) {
    if (useAll) {
      await new Promise(res => setTimeout(res, 1000))
    }
    view.tracks[0].displays[0].setPhasedMode('phased')
  }

  if (useAll) {
    fireEvent.click((await findAllByText('Force load', ...opts))[0]!)
    expectCanvasMatch((await findAllByTestId(/prerendered_canvas/, ...opts))[0]!)
  } else {
    fireEvent.click(await findByText('Force load', ...opts))
    expectCanvasMatch(await findByTestId(/prerendered_canvas/, ...opts))
  }
}

export { default as JBrowse } from './TestingJBrowse'

export { generateReadBuffer } from './generateReadBuffer'
