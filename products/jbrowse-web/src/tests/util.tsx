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

// web's root model names WebWorkerRpcDriver as its host default, and web
// workers don't run under jest (makeWorkerInstance is mocked to a no-op) — so
// pin the main thread through the config slot that exists for exactly this,
// rather than reaching into the RpcManager after it is built
function onMainThreadRpc(jbrowse: Record<string, unknown>) {
  const { configuration } = jbrowse
  return {
    ...jbrowse,
    configuration: {
      ...(configuration && typeof configuration === 'object'
        ? configuration
        : {}),
      rpc: { defaultDriver: 'MainThreadRpcDriver' },
    },
  }
}

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
      jbrowse: onMainThreadRpc(initialState ?? configSnapshot),
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

/**
 * The volvox config with all but the named tracks removed.
 *
 * The track selector is open in `defaultSession`, and `useMeasure` is mocked to
 * a 100000px height so its virtualization never kicks in — so every
 * `createView()` mounts a row per track, all 123 of them, before a test has
 * done anything. Measured, that is most of what `createView()` costs: ~1.5s and
 * a 2094-element document with the full config, versus ~0.4s and ~300 elements
 * with one track. It is also paid twice over, because every later `findBy*` in
 * the test scans that document.
 *
 * A suite that names its tracks keeps the coverage it actually has — the track
 * is still switched on by clicking its row in the real selector — and stops
 * paying for the 120 rows it never touches. Only trim a suite whose tracks are
 * known: anything walking the tree itself (categories, filter text, counts)
 * needs the whole config, as does anything asserting on what is *not* shown.
 */
export function volvoxConfigWithTracks(trackIds: string[]) {
  const keep = new Set(trackIds)
  const tracks = configSnapshot.tracks.filter(t => keep.has(t.trackId))
  const missing = trackIds.filter(id => !tracks.some(t => t.trackId === id))
  if (missing.length) {
    throw new Error(`no such track in the volvox config: ${missing.join(', ')}`)
  }
  return { ...configSnapshot, tracks }
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
 * Wait for a display of the given TYPE to finish first paint.
 *
 * The jsdom counterpart of `displayPainted` from `@jbrowse/capture`, and the
 * replacement for `findByTestId('<base>-done')`: `data-testid` no longer
 * mutates on paint (ADR-065), so "this display type, painted" is a conjunction
 * of the stable testid and `data-display-drawn`.
 *
 * It reports **which half** failed, which is the thing the old suffix could not
 * do — `findDisplayPainted('pileup-display')` timing out was equally consistent
 * with "no pileup display mounted" and "it mounted and never painted", and
 * those have completely different causes.
 */
export async function findDisplayPainted(
  testid: string,
  // Same shape as the `waitFor` options every call site already passes to
  // `findByTestId` as its third argument, so the migration off the suffix was a
  // rename rather than a re-timing.
  { timeout = 20000 }: { timeout?: number } = {},
) {
  return waitFor(
    () => {
      // No `CSS.escape`, same as findDisplayById below: this runs in jsdom,
      // which has no `CSS` object at all, so the rule's autofix breaks every
      // caller at runtime. Each selector is kept on its own line so the disable
      // can't drift off the interpolation when the formatter rewraps the call.
      // eslint-disable-next-line unicorn/require-css-escape
      const base = `[data-testid="${testid}"]`
      const el = document.querySelector<HTMLElement>(
        `${base}[data-display-drawn="true"]`,
      )
      if (!el) {
        throw new Error(
          document.querySelector(base)
            ? `display ${testid} mounted but has not painted (data-display-drawn is still "false")`
            : `no display with data-testid="${testid}" is mounted`,
        )
      }
      return el
    },
    { timeout },
  )
}

/**
 * Wait for one specific display to finish first paint, by `data-display-id`.
 *
 * The narrower sibling of `findDisplayPainted`: `data-testid` names the display
 * *type*, so two alignments displays in a breakpoint-split view share
 * `pileup-display` and only the display id tells them apart.
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

/**
 * Wait for a display to be *settled* — painted AND no longer working.
 *
 * The stricter sibling of {@link findDisplayPainted}, for the callers that flip
 * a track-menu setting on a display that has ALREADY painted. `data-display-
 * drawn` is first paint, so it is true throughout for them: waiting on it
 * observes the previous frame and snapshots it. That is what the flat
 * `setTimeout(2000)`s in the linked-read suites were covering — not a race
 * anyone had diagnosed, just a delay long enough that the second paint had
 * usually landed. Measured, the real settle is 6-334ms.
 *
 * `data-display-phase` is the model's own mutually-exclusive state and covers
 * the whole refetch rather than the paint, so the conjunction is the real
 * signal — the same one the screenshot specs wait on via `displayReady`.
 *
 * It is sampled twice because the conjunction alone does not close the window
 * here: the phase is the only moving term for these callers, and a refetch the
 * setting triggered has not necessarily left `ready` at the instant we first
 * look. The second sample gives an imminent `loading` somewhere to appear.
 *
 * **Only for a setting whose change REFETCHES.** One that merely repaints —
 * anything in the `renderState` tier, per `LinearAlignmentsDisplay/CLAUDE.md`'s
 * invalidation tiers — never moves the phase, so this returns immediately with
 * the previous frame still up. Not hypothetical: `BigWigColor` was ported to
 * this and captured the pre-recolor canvas (the default blue, 68% different
 * from the green it had just asked for) while the phase sat at `ready`
 * throughout. Those callers still sleep, and that is why.
 */
export async function findSettledDisplay(
  testid = 'pileup-display',
  { timeout = 30000 }: { timeout?: number } = {},
) {
  const find = async () => {
    const el = await findDisplayPainted(testid, { timeout })
    if (el.dataset.displayPhase !== 'ready') {
      throw new Error(
        `display ${testid} painted but is at phase "${el.dataset.displayPhase}", not "ready"`,
      )
    }
    return el
  }
  await waitFor(find, { timeout })
  await new Promise(res => setTimeout(res, 100))
  return waitFor(find, { timeout })
}

/**
 * Wait for *any* display to finish first paint — the caller does not care which
 * type, only that something has drawn.
 *
 * This used to be `findAllByTestId(/-display-done$/)`: a regex, because "any
 * display" could only be expressed as a pattern over the mutating testid. One
 * attribute says it directly now, and the pattern took the two chrome-less
 * views (`synteny_canvas_done`, `dotplot_webgl_canvas_done`) with it — they do
 * not end in `-display-done` and were silently outside every such match.
 */
export async function findAnyDisplayPainted({
  timeout = 20000,
}: { timeout?: number } = {}) {
  return waitFor(
    () => {
      const el = document.querySelector<HTMLElement>(
        '[data-display-drawn="true"]',
      )
      if (!el) {
        throw new Error('no display has painted')
      }
      return el
    },
    { timeout },
  )
}

/** Wait for a display to finish rendering and return its canvas element. */
export async function waitForRenderedCanvas(timeout = 20000) {
  return findCanvasIn(await findAnyDisplayPainted({ timeout }))
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

// How many snapshots have failed to match so far in this file. `expect.getState`
// is jest's own handle on the state its snapshot reporter reads at the end of
// the run, which is where a mismatch is recorded — the matcher itself does not
// throw.
function snapshotMismatches() {
  const { snapshotState } = expect.getState() as unknown as {
    snapshotState: { unmatched: number }
  }
  return snapshotState.unmatched
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
  // ONLY WHEN THE SNAPSHOT ACCEPTED THESE BYTES. The golden `.svg` and the
  // `.snap` hold the same string for two readers — the golden is the one a
  // human diffs, the `.snap` is what fails a run — so a golden the `.snap`
  // rejected is a picture of the bug, and it reads in `git status` as somebody's
  // pending snapshot update rather than as red CI.
  //
  // Sequencing alone does not buy that: `toMatchSnapshot` records its verdict
  // and RETURNS, so everything after it runs on a red run too. Count the
  // mismatch instead.
  const before = snapshotMismatches()
  expect(svg).toMatchSnapshot()
  if (snapshotMismatches() === before) {
    const dir = path.dirname(module.filename)
    fs.writeFileSync(`${dir}/__image_snapshots__/${filename}_snapshot.svg`, svg)
  }
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
  /**
   * Which display type must have repainted after the reload. Omit for "any
   * display" — which used to be spelled `/-display-done$/`, the reason this was
   * a `string | RegExp` union at all.
   */
  displayTestId?: string
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

    const displayEl = config.displayTestId
      ? await findDisplayPainted(config.displayTestId, delay)
      : await findAnyDisplayPainted(delay)
    const canvas = displayEl.querySelector('canvas') ?? displayEl
    expectCanvasMatch(canvas)
  })
}

export async function openSpreadsheetView({
  screen,
  fileUrl,
  timeout,
}: {
  screen: any
  fileUrl: string
  timeout?: number
}) {
  const delay = { timeout: timeout ?? 50000 }
  const opts = [{}, delay]
  const { session } = await createView()

  fireEvent.click(await screen.findByText('File'))
  fireEvent.click(await screen.findByText('Add'))
  fireEvent.click(await screen.findByText('Spreadsheet view'))

  fireEvent.change(await screen.findByTestId('urlInput', ...opts), {
    target: { value: fileUrl },
  })

  await waitFor(() => {
    expect(screen.getByTestId('open_spreadsheet')).not.toBeDisabled()
  }, delay)

  fireEvent.click(await screen.findByTestId('open_spreadsheet'))

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
