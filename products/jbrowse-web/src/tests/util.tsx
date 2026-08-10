/* eslint-disable react-refresh/only-export-components */
import fs from 'node:fs'
import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { saveAs } from '@jbrowse/core/util'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { Image, createCanvas } from 'canvas'
import { LocalFile } from 'generic-filehandle2'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

import configSnapshot from '../../test_data/volvox/config.json' with { type: 'json' }
import corePlugins from '../corePlugins.ts'
import JBrowseRootModelFactory from '../rootModel/rootModel.ts'
import sessionModelFactory from '../sessionModel/index.ts'
import JBrowse from './TestingJBrowse.tsx'
import { generateReadBuffer } from './generateReadBuffer.ts'

import type { WebSessionModel } from '../sessionModel/index.ts'
import type { AppRootModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { SpreadsheetViewModel } from '@jbrowse/plugin-spreadsheet-view'
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

  // web defaults to WebWorkerRpcDriver, but web workers don't run under jest
  // (makeWorkerInstance is mocked to a no-op), so force the main-thread driver
  rootModel.rpcManager.defaultDriverName = 'MainThreadRpcDriver'

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

export const hts = (str: string) => `htsTrackLabel-Tracks,${str}`

export function findCanvasIn(container: HTMLElement) {
  const canvas = container.querySelector('canvas')
  if (!canvas) {
    throw new Error('No canvas found in container')
  }
  return canvas
}

/**
 * Wait for one specific display to finish first paint, by `data-display-id`.
 *
 * Not a testid: `data-testid` is the display *type*'s base, so two alignments
 * displays in a breakpoint-split view share `pileup-display-done` and only the
 * display id tells them apart. This replaced `display-<displayId>-done`, which
 * worked only while a second wrapper element existed to emit that id.
 */
export async function findDisplayById(displayId: string, timeout = 20000) {
  return waitFor(
    () => {
      // No `CSS.escape` here, unlike the browser-tests copies: this runs in
      // jsdom, which has no `CSS` object at all. Display ids are generated.
      // Kept on its own line so the disable can't drift off the interpolation
      // when the formatter rewraps the call.
      // eslint-disable-next-line unicorn/require-css-escape
      const selector = `[data-display-id="${displayId}"][data-display-drawn="true"]`
      const el = document.querySelector<HTMLElement>(selector)
      if (!el) {
        throw new Error(`display ${displayId} has not painted`)
      }
      return el
    },
    { timeout },
  )
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
  const displays = await findAllByTestId(/-display-done$/, {}, { timeout })
  return findCanvasIn(displays[0]!)
}

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

export interface Results extends ReturnType<typeof render> {
  view: LGV
  session: WebSessionModel
  rootModel: AppRootModel
}

export function createViewNoWait(args?: any, adminMode?: boolean): Results {
  const { pluginManager, rootModel } = getPluginManager(args, adminMode)
  const rest = render(<JBrowse pluginManager={pluginManager} />)
  const session = rootModel.session! as WebSessionModel
  const view = session.views[0] as LGV
  return { view, rootModel, session, ...rest }
}

/**
 * Build an unrendered root model with its web session + first LGV, for pure
 * model-logic tests that don't need a React render. Typed via the real
 * WebSessionModel/LGV so callers don't hand-roll ad-hoc cast interfaces.
 */
export function getTestSession(
  args?: Record<string, unknown>,
  adminMode?: boolean,
) {
  const { rootModel } = getPluginManager(args, adminMode)
  const session = rootModel.session! as WebSessionModel
  const view = session.views[0] as LGV
  return { rootModel, session, view }
}

export function doBeforeEach(
  cb = (str: string) =>
    require.resolve(
      `../../test_data/volvox/${str.replace('http://localhost:3000/test_data/volvox/', '')}`,
    ),
) {
  clearCache()
  clearAdapterCache()

  fetchMock.resetMocks()
  fetchMock.mockResponse(generateReadBuffer(url => new LocalFile(cb(url))))
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
  fetchMock.mockResponse(async request => {
    const matches = request.url.includes(str)
    return matches ? { status: 404 } : readBuffer(request)
  })
}

// SVG ids must be unique within a document — a duplicate id makes
// <clipPath>/<use> references resolve to the first match only, silently
// breaking clipping for every later element sharing that id.
function assertNoDuplicateSvgIds(svg: string) {
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)]
    .map(m => m[1])
    .filter((id): id is string => id !== undefined)
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id)
    }
    seen.add(id)
  }
  expect([...duplicates]).toEqual([])
}

// Every `url(#x)` in an export must resolve to an `id="x"` in the same
// document — these files are self-contained, so there is nowhere else for a
// reference to point. A dangling one is silent at render time: the clip simply
// never applies and the element paints over its neighbours, or a gradient fill
// comes out transparent. That is how ids built out of config text (a trackId
// like `Genes (curated)`, a refName like `gi|123|ref|NC_000001|`) used to break
// an export, since `url()` cannot carry parens, quotes or spaces — see
// svgSafeId.
function assertNoDanglingSvgRefs(svg: string) {
  const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]!))
  const dangling = [...svg.matchAll(/url\(#([^)]*)\)/g)]
    .map(m => m[1]!)
    .filter(ref => !ids.has(ref))
  expect([...new Set(dangling)]).toEqual([])
}

/**
 * Every SVG string exported so far in this test, in call order. Relies on the
 * `svgExportMocks.ts` Blob mock, which stores constructor args as
 * `{ content: [svgString], options }`.
 */
export function getSavedSvgs(): string[] {
  const mock = saveAs as unknown as { mock: { calls: unknown[][] } }
  return mock.mock.calls.map(call => {
    const blob = call[0] as { content: string[] }
    return blob.content[0]!
  })
}

/**
 * The SVG from the one export this test did.
 *
 * Throws rather than picking one when a test exported more than once. It used
 * to return the first silently, which is a trap a comparison test falls into
 * from the far side: export with an option off, export with it on, call this
 * twice, and both reads hand back the *first* string — so the test passes or
 * fails on whether the option had no effect, which is the opposite of what it
 * says it checks. Use {@link getSavedSvgs} and index when comparing.
 */
export function getSavedSvg(): string {
  const svgs = getSavedSvgs()
  if (svgs.length !== 1) {
    throw new Error(
      `getSavedSvg expects exactly one export in a test, saw ${svgs.length}. ` +
        `Use getSavedSvgs() and index if you are comparing two exports.`,
    )
  }
  return svgs[0]!
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

  const svg = getSavedSvg()
  assertNoDuplicateSvgIds(svg)
  assertNoDanglingSvgRefs(svg)
  expect(svg).toMatchSnapshot()
  // AFTER the match, not before. The golden `.svg` and the `.snap` hold the
  // same bytes for two readers — the golden is the one a human diffs, the
  // `.snap` is what fails a run — and writing unconditionally let the two
  // disagree: a render change rewrote the golden, the .snap kept the old bytes,
  // and the failing test read in `git status` as somebody's pending snapshot
  // update rather than as red CI. Written here, the golden only moves when the
  // assertion it is a copy of has accepted the same string.
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/${filename}_snapshot.svg`, svg)
  return svg
}

const volvoxReadBuffer = generateReadBuffer(
  url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
)

export async function testFileReload(config: {
  failingFile: string
  readBuffer?: (request: Request) => Promise<Response>
  trackId: string
  viewLocation: [number, number]
  expectedCanvas: string | RegExp
  timeout?: number
}) {
  const readBuffer = config.readBuffer ?? volvoxReadBuffer
  const delay = { timeout: config.timeout ?? 30000 }
  const opts = [{}, delay]

  await mockConsole(async () => {
    mockFile404(config.failingFile, readBuffer)
    const { view, findByTestId, findAllByTestId, findAllByText } =
      await createView()
    view.setNewView(config.viewLocation[0], config.viewLocation[1])
    fireEvent.click(await findByTestId(hts(config.trackId), ...opts))
    await findAllByText(/HTTP 404/, ...opts)

    fetchMock.mockResponse(readBuffer)
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

  // Wait for the file load to settle before returning: otherwise callers that
  // don't wait on anything further leave the test while it's still in
  // flight, and its resolution after teardown throws "require a file after
  // the Jest environment has been torn down" from the import wizard's
  // dynamic unzip import.
  const view = session.views.at(-1) as SpreadsheetViewModel
  await waitFor(() => {
    expect(view.spreadsheet).toBeDefined()
  }, delay)

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
