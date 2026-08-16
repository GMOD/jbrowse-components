import { ChildProcess, execSync, spawn } from 'child_process'
import { chmodSync, mkdtempSync, writeFileSync } from 'fs'
import http from 'http'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

import { PENDING_DISPLAYS } from '@jbrowse/browser-test-utils'
import { Builder, By, Key, WebDriver, logging, until } from 'selenium-webdriver'
import handler from 'serve-handler'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

export const REPO_ROOT = resolve(__dirname, '../../..')
export const TEST_DATA_DIR = resolve(__dirname, '../../../test_data/volvox')
export const isWindows = process.platform === 'win32'
export const isHeadless =
  process.argv.includes('--headless') || process.env.HEADLESS === 'true'

export const APP_BINARY = resolve(
  __dirname,
  isWindows
    ? '../dist/unpacked/jbrowse-desktop-win32-x64/jbrowse-desktop.exe'
    : '../dist/unpacked/jbrowse-desktop-linux-x64/jbrowse-desktop',
)

const CHROMEDRIVER_PORT = 9515
const electronChromedriverDir = dirname(
  require.resolve('electron-chromedriver/package.json'),
)
const CHROMEDRIVER_PATH = join(
  electronChromedriverDir,
  'bin',
  isWindows ? 'chromedriver.exe' : 'chromedriver',
)

export const delay = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

export async function startChromedriver(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    console.log(`  Launching: ${CHROMEDRIVER_PATH}`)
    const proc = spawn(CHROMEDRIVER_PATH, [`--port=${CHROMEDRIVER_PORT}`], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    proc.on('error', err => {
      console.error('  ChromeDriver spawn error:', err)
      reject(err)
    })
    proc.stdout?.on('data', data => {
      const output = data.toString()
      console.log('  ChromeDriver stdout:', output.trim())
      if (output.includes('was started successfully')) {
        resolve(proc)
      }
    })
    proc.stderr?.on('data', data => {
      console.log('  ChromeDriver stderr:', data.toString().trim())
    })
    // Fallback timeout - give it more time to start
    setTimeout(() => {
      resolve(proc)
    }, 5000)
  })
}

// Launching the app *with a file argument* (the `jbrowse-desktop config.json`
// route) can't go through chromeOptions.args: chromedriver reads every entry
// there as a switch and re-emits it with a `--` prefix, so a bare path arrives
// as `--/tmp/…/config.json` and the app resolves it against its own cwd. A
// wrapper script puts the path in argv itself, ahead of chromedriver's own
// switches, and `exec` replaces the shell so no extra process outlives the app.
function writeLaunchWrapper(launchFile: string) {
  if (isWindows) {
    throw new Error(
      'createDriver({ launchFile }) is implemented for the sh wrapper only, and the desktop figures are generated on linux',
    )
  }
  const wrapper = join(
    mkdtempSync(join(tmpdir(), 'jbrowse-desktop-launch-')),
    'launch.sh',
  )
  writeFileSync(
    wrapper,
    `#!/bin/sh\nexec "${APP_BINARY}" "${launchFile}" "$@"\n`,
  )
  chmodSync(wrapper, 0o755)
  return wrapper
}

export async function createDriver({
  launchFile,
}: { launchFile?: string } = {}): Promise<WebDriver> {
  // A throwaway profile per run, not the developer's own JBrowse Desktop one.
  // createMainWindow sizes itself from windowStateKeeper, which persists into
  // userData, so a machine where the app was last left 845px wide captured
  // every figure 845px wide next to committed ones at 1400. Selenium can't fix
  // it after the fact (electron's chromedriver has no Browser.getWindowForTarget,
  // so window().setRect throws); an empty profile falls back to the electron
  // defaults, and the run stops inheriting recent sessions too.
  //
  // Seeding a window-state.json into that profile was considered and is not
  // worth it. The fallback is not "some electron default" but the app's own
  // DEFAULT_WINDOW_WIDTH/HEIGHT in electron/window.ts (1400x800), which is what
  // the committed figures were captured at — so a seed would copy that constant
  // into the harness, where it drifts silently the day the app default moves.
  // It also would not explain the one 845x763 run that happened with this
  // profile in place: the viewport was 555px narrower than the window with the
  // height correct, which is docked DevTools, not a window size.
  const chromeArgs = [
    '--no-sandbox',
    '--disable-extensions',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'jbrowse-desktop-test-'))}`,
  ]
  if (isHeadless) {
    chromeArgs.push(
      // These turn off WebGPU *and* WebGL2, so a headless desktop figure is
      // captured through the Canvas2D fallback rather than the backend a real
      // user renders on. Swapping them for the web generator's
      // --use-gl=swiftshader --enable-unsafe-swiftshader was tried and crashes
      // the electron app mid-run (the window dies during the first dialog), so
      // headless desktop figures stay on Canvas2D until that is understood.
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--force-device-scale-factor=1',
    )
  }

  const prefs = new logging.Preferences()
  prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL)

  const driver = await new Builder()
    .usingServer(`http://localhost:${CHROMEDRIVER_PORT}`)
    .withCapabilities({
      'goog:chromeOptions': {
        binary: launchFile ? writeLaunchWrapper(launchFile) : APP_BINARY,
        args: chromeArgs,
      },
      'goog:loggingPrefs': {
        browser: 'ALL',
      },
    })
    .setLoggingPrefs(prefs)
    .forBrowser('chrome')
    .build()

  await driver.manage().setTimeouts({
    implicit: 30000,
    pageLoad: 120000,
    script: 60000,
  })

  return driver
}

export async function flushBrowserLogs(driver: WebDriver): Promise<void> {
  try {
    const logs = await driver.manage().logs().get(logging.Type.BROWSER)
    for (const entry of logs) {
      console.log(`    [Browser ${entry.level.name}] ${entry.message}`)
    }
  } catch (e) {
    console.warn('    WARN: could not fetch browser logs:', e)
  }
}

// Case-insensitive XPath text search
export function textContainsXPath(text: string, elementType = '*') {
  const lowerText = text.toLowerCase()
  return `//${elementType}[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lowerText}')]`
}

export async function findByText(
  driver: WebDriver,
  text: string,
  timeout = 30000,
) {
  return driver.wait(
    until.elementLocated(By.xpath(textContainsXPath(text))),
    timeout,
  )
}

export async function clickButton(
  driver: WebDriver,
  text: string,
  timeout = 10000,
): Promise<void> {
  const button = await driver.wait(
    until.elementLocated(By.xpath(textContainsXPath(text, 'button'))),
    timeout,
  )
  await driver.wait(until.elementIsVisible(button), timeout)
  // Use JavaScript click to bypass any backdrop overlays
  await driver.executeScript('arguments[0].click();', button)
}

// Clear input field using keyboard shortcuts
export async function clearInput(
  driver: WebDriver,
  element: any,
): Promise<void> {
  await element.click()
  await driver
    .actions()
    .keyDown(Key.CONTROL)
    .sendKeys('a')
    .keyUp(Key.CONTROL)
    .perform()
  await driver.actions().sendKeys(Key.DELETE).perform()
}

export async function waitForStartScreen(
  driver: WebDriver,
  timeout = 30000,
): Promise<void> {
  await findByText(driver, 'Launch new session', timeout)
}

// The live session model, published on window by the desktop JBrowse component
// the same way jbrowse-web does. Reading state from it beats reading rendered
// text: `visibleLocStrings` is the view's actual position, while the location box
// shows the debounced `coarseVisibleLocStrings`, and the track and widget lists
// have no faithful DOM equivalent at all.
export interface SessionProbe {
  locStrings: string[]
  trackIds: string[]
  widgetTypes: string[]
}

export async function readSession(
  driver: WebDriver,
): Promise<SessionProbe | undefined> {
  // `visibleLocStrings` reaches `view.width`, which throws by design on a view
  // that hasn't been measured yet, so each read is guarded rather than letting
  // one pre-init view fail the whole probe.
  return driver.executeScript<SessionProbe | undefined>(`
    const session = window.JBrowseSession
    if (!session) { return undefined }
    const views = session.views ?? []
    const locStrings = []
    for (const view of views) {
      try {
        if (view.visibleLocStrings) { locStrings.push(view.visibleLocStrings) }
      } catch (e) {}
    }
    return {
      locStrings,
      trackIds: views.flatMap(view =>
        (view.tracks ?? []).map(t => t.configuration.trackId),
      ),
      widgetTypes: [...(session.activeWidgets?.values() ?? [])].map(w => w.type),
    }
  `)
}

// Blocks until the session satisfies `check`, returning the last probe so a
// caller can put the real state in its own error message.
export async function waitForSession(
  driver: WebDriver,
  check: (probe: SessionProbe) => boolean,
  timeout = 30000,
): Promise<SessionProbe | undefined> {
  const deadline = Date.now() + timeout
  let last: SessionProbe | undefined
  while (Date.now() < deadline) {
    last = await readSession(driver)
    if (last && check(last)) {
      return last
    }
    await delay(250)
  }
  return last
}

// Blocks until the desktop text-indexing queue has run and drained.
//
// Adding a GFF3 track queues a name-indexing job (doSubmit's textIndexTrack,
// on by default), and until that job finishes there is no text search adapter
// for a feature-name lookup to hit. The autocomplete does not retry a query it
// has already answered, so a search typed while indexing is still running gets
// an empty dropdown and then stays empty however long the caller waits on it —
// which is a race, and it lost about half the time: a passing run indexed in
// ~15s, a failing one had not finished by the time the query went in.
//
// Reads the job queue rather than the track's config: `running` and `jobsQueue`
// are what indexJobsModel actually drives, and they say "started" as well as
// "finished". Call it immediately after the submit that queues the job —
// `queueJob` runs synchronously there, so the queue is non-empty on the first
// poll. Called later it may find the queue already drained, which is
// indistinguishable from "not queued yet", hence the grace period; a caller in
// the right place never reaches it.
export async function waitForIndexingToFinish(
  driver: WebDriver,
  { timeout = 180000, grace = 5000 } = {},
): Promise<void> {
  const start = Date.now()
  let sawWork = false
  let readModel = false
  while (Date.now() - start < timeout) {
    const state = await driver.executeScript<
      { running: boolean; queued: number } | undefined
    >(`
      const jm = window.JBrowseRootModel?.jobsManager
      return jm ? { running: jm.running, queued: jm.jobsQueue.length } : undefined
    `)
    if (state) {
      readModel = true
    }
    if (state?.running || (state?.queued ?? 0) > 0) {
      sawWork = true
    } else if (sawWork) {
      console.log(`    DEBUG: indexing drained after ${Date.now() - start}ms`)
      return
    } else if (Date.now() - start > grace) {
      // Distinguished on purpose: an unreadable jobsManager means this is a
      // sleep pretending to be a synchronisation point, which is worth knowing
      // rather than passing quietly.
      console.log(
        readModel
          ? '    DEBUG: no indexing job queued, continuing'
          : '    WARN: could not read jobsManager; not waiting on indexing',
      )
      return
    }
    await delay(500)
  }
  console.warn(`    WARN: indexing still running after ${timeout}ms`)
}

// Blocks until the view's span stops moving. A locstring is a function of the
// view's width, so it keeps changing after the content is "there": opening the
// results drawer narrows the view, and a track growing tall enough to raise a
// vertical scrollbar narrows it again — each reflow re-spans at the same
// bpPerPx. Capturing between those two reflows and after them yields figures
// that differ across the whole ruler, which is what makes an otherwise
// deterministic figure churn. Settling on repeated identical reads costs one
// extra interval and removes the race for every caller.
export async function waitForStableSession(
  driver: WebDriver,
  { interval = 500, reads = 3, timeout = 30000 } = {},
): Promise<SessionProbe | undefined> {
  const deadline = Date.now() + timeout
  let recent: string[] = []
  let last: SessionProbe | undefined
  while (Date.now() < deadline) {
    last = await readSession(driver)
    recent = [...recent, JSON.stringify(last?.locStrings)].slice(-reads)
    if (recent.length === reads && new Set(recent).size === 1) {
      return last
    }
    await delay(interval)
  }
  console.warn(`    WARN: view span still moving: ${recent.join(' -> ')}`)
  return last
}

// Poll a page-context expression until its result satisfies `check`, returning
// the last read either way so a caller's error message can name the real state.
async function waitFor<T>(
  driver: WebDriver,
  script: string,
  check: (value: T) => boolean,
  timeout: number,
): Promise<T> {
  const deadline = Date.now() + timeout
  let last = JSON.parse(await driver.executeScript<string>(script)) as T
  while (!check(last) && Date.now() < deadline) {
    await delay(500)
    last = JSON.parse(await driver.executeScript<string>(script)) as T
  }
  return last
}

// "Is this gone yet?" asked through the DOM rather than findElements, which
// waits out the 30s implicit timeout every time the answer is "yes, none left" —
// the dominant cost of a screenshot run, since every cleanup step ends that way.
export async function countElements(
  driver: WebDriver,
  css: string,
): Promise<number> {
  return driver.executeScript<number>(
    'return document.querySelectorAll(arguments[0]).length',
    css,
  )
}

// Readiness instead of a sleep, off the same signals the web screenshot
// generator waits on (`packages/browser-test-utils/src/waits.ts`), read through
// executeScript because this harness drives selenium rather than puppeteer:
//
// - `data-view-phase=loading` — the view is still waiting on its assembly (or on
//   init's navigation) and has mounted no displays at all, so every signal below
//   is silent and a capture lands on a bare spinner. Blocking: a view that never
//   leaves this has no content to fall through to, so the timeout is the answer.
// - a *visible* `loading-overlay` — the idle overlay stays in the DOM at
//   opacity 0, so it has to be tested for visibility rather than presence.
// - `data-display-phase=loading` — a display's fetch is still in flight.
// - a display wrapper still wearing its base test-id: DisplayChrome flips the id
//   to `<base>-done` on first paint, so anything still on the base id is pending.
//
// The last two are best-effort, as they are in the web generator: a display in a
// terminal too-large/error state renders no wrapper and publishes no phase, so
// waiting on them strictly would fail a figure whose subject is that state.
// Imported, not re-stated: this was a hand-copy of the web generator's selector
// and it had already gone stale — it still enumerated the three testid shapes
// that existed before displays published `data-display-drawn`, and matched only
// by accident (every base happens to end in `-display`). One export, one answer.

interface PendingWork {
  blocking: string[]
  settling: string[]
}

async function getPendingWork(driver: WebDriver): Promise<PendingWork> {
  return driver.executeScript<PendingWork>(
    `
    const pendingDisplays = arguments[0]
    const isVisible = el => {
      for (let cur = el; cur; cur = cur.parentElement) {
        const s = getComputedStyle(cur)
        if (
          s.display === 'none' ||
          s.visibility === 'hidden' ||
          Number(s.opacity) === 0
        ) {
          return false
        }
      }
      const { width, height } = el.getBoundingClientRect()
      return width > 0 && height > 0
    }
    const count = sel => document.querySelectorAll(sel).length
    const overlays = Array.from(
      document.querySelectorAll('[data-testid="loading-overlay"]'),
    ).filter(isVisible).length
    const blocking = []
    const settling = []
    const views = count('[data-view-phase="loading"]')
    if (views) { blocking.push(views + ' view(s) loading') }
    if (overlays) { blocking.push(overlays + ' loading overlay(s)') }
    const displays = count('[data-display-phase="loading"]')
    if (displays) { settling.push(displays + ' display(s) loading') }
    const unpainted = count(pendingDisplays)
    if (unpainted) { settling.push(unpainted + ' display(s) unpainted') }
    return { blocking, settling }
  `,
    PENDING_DISPLAYS,
  )
}

// Blocks until the app has nothing left in flight, and says what it was waiting
// on if it runs out of time rather than failing as a bare timeout.
//
// The signals have to stay clear for `settleMs`, not merely read clear once. A
// display's fetch autorun is debounced, so straight after a navigation nothing
// has started loading yet: every signal reads ready, and a capture taken there
// gets the track's blank canvas. (That is not hypothetical — it blanked the
// RefSeq lane behind the in-silico PCR dialog.) The settle window has to outlast
// that debounce.
export async function waitForAppReady(
  driver: WebDriver,
  { timeout = 60000, settleMs = 1500 } = {},
): Promise<void> {
  const deadline = Date.now() + timeout
  let last: PendingWork = { blocking: [], settling: [] }
  let clearSince: number | undefined
  while (Date.now() < deadline) {
    last = await getPendingWork(driver)
    if (last.blocking.length === 0 && last.settling.length === 0) {
      if (clearSince === undefined) {
        clearSince = Date.now()
      }
      if (Date.now() - clearSince >= settleMs) {
        return
      }
    } else {
      clearSince = undefined
    }
    await delay(250)
  }
  const detail = [...last.blocking, ...last.settling].join(', ')
  if (last.blocking.length > 0) {
    throw new Error(`app never finished loading: ${detail}`)
  }
  // a too-large or errored display publishes no phase and renders no wrapper, so
  // anything still pending here is a display that legitimately has no more to
  // say — worth reporting next to the capture, not worth failing the run over
  console.warn(`    WARN: proceeding with ${detail}`)
}

// Close whatever drawer widgets the previous step opened. A figure of "the
// track is added" is a figure of the view, not of the jobs list that track
// indexing opens beside it, and the drawer also narrows the view it sits next
// to. Goes through the session rather than the drawer's close button because
// the widget that has to go is not always the one on top.
export async function hideAllWidgets(driver: WebDriver): Promise<void> {
  await driver.executeScript('window.JBrowseSession?.hideAllWidgets?.()')
}

// Hide the toast a background job leaves behind. It is real UI, but it is
// transient, and a reader looking at a figure of a finished state has no way to
// tell that it was already fading when the frame was taken.
export async function hideSnackbars(driver: WebDriver): Promise<void> {
  await driver.executeScript(`
    for (const el of document.querySelectorAll('.MuiSnackbar-root')) {
      el.style.display = 'none'
    }
  `)
}

export async function waitForBackdropsToDisappear(
  driver: WebDriver,
  timeout = 5000,
): Promise<void> {
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    if ((await countElements(driver, '.MuiBackdrop-root')) === 0) {
      return
    }
    await delay(200)
  }
}

// Close all dialogs, menus, and backdrops
export async function cleanupUI(driver: WebDriver): Promise<void> {
  for (let i = 0; i < 5; i++) {
    if ((await countElements(driver, '.MuiDialog-root')) === 0) {
      break
    }
    await driver.actions().sendKeys(Key.ESCAPE).perform()
    await delay(300)
  }

  if ((await countElements(driver, '.MuiBackdrop-root')) > 0) {
    const backdrops = await driver.findElements(By.css('.MuiBackdrop-root'))
    for (const backdrop of backdrops) {
      try {
        await driver.executeScript('arguments[0].click();', backdrop)
        await delay(200)
      } catch (e) {
        console.warn(
          '    WARN: backdrop dismiss failed (likely already gone):',
          e,
        )
      }
    }
  }

  for (let i = 0; i < 3; i++) {
    await driver.actions().sendKeys(Key.ESCAPE).perform()
    await delay(200)
  }
  try {
    const body = await driver.findElement(By.css('body'))
    await driver.executeScript('arguments[0].click();', body)
    await delay(300)
  } catch (e) {
    console.warn('    WARN: body click during cleanup failed:', e)
  }
}

// Open a top-level menu and leave it open. Split out of openMenuItem so a
// figure can be captured of the menu itself, which is the first step of every
// menu-driven procedure the docs describe.
export async function openMenu(
  driver: WebDriver,
  menuName: string,
): Promise<void> {
  await clickButton(driver, menuName)
  await delay(500)
}

export async function clickMenuItem(
  driver: WebDriver,
  itemText: string,
): Promise<void> {
  const menuItem = await driver.wait(
    until.elementLocated(By.xpath(`//*[contains(text(), '${itemText}')]`)),
    5000,
  )
  await driver.wait(until.elementIsVisible(menuItem), 3000)
  await driver.executeScript('arguments[0].click();', menuItem)
  await delay(500)
}

// Open a menu and click an item within it
export async function openMenuItem(
  driver: WebDriver,
  menuName: string,
  itemText: string,
): Promise<void> {
  await openMenu(driver, menuName)
  await clickMenuItem(driver, itemText)
}

// Serve a directory over http. Desktop loads picked local files via LocalFile
// (localPath), but a typed file:// URL becomes a UriLocation that the packaged
// renderer's fetch refuses — so screenshots serve test_data over http instead.
export async function startStaticServer(
  rootDir: string,
  port: number,
): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    void handler(req, res, { public: rootDir })
  })
  return new Promise((resolve, reject) => {
    server.on('error', reject)
    // Bind IPv4 explicitly so the Chromium fetch of http://127.0.0.1 resolves
    // (localhost can resolve to ::1 while the server listens on IPv4 → fetch fails)
    server.listen(port, '127.0.0.1', () => {
      resolve(server)
    })
  })
}

// Load the volvox assembly through the "Open new genome" dialog, then navigate
// to a region so the view fully paints.
//
// Pass `volvox.2bit`. A `.fa` with its `.fai` classifies as an indexed FASTA
// correctly now, but a plain `.fa` on its own routes through `indexFasta`
// (electron/ipc/fileHandlers.ts, whose output shows up as a `LocalPathLocation`
// under the profile's `fai/` dir), and that step hangs often enough to fail a
// run — the assembly sits `initialized: false` with no error and the import form
// reads "Loading" forever. A 2bit needs no index at all, so it stays clear of
// the whole path — see agent-docs/reference/DESKTOP_SCREENSHOTS.md.
//
// What made a `.fa` + `.fai` pair land as a bare FASTA anyway, and cost the
// Windows job a run at random: `sendKeys` types one character at a time, and the
// URL box unmounted the moment its contents classified as a sequence, so the
// second line was never typed. AddGenomePane keeps that box mounted now and
// AddGenomePane.test.tsx holds the line.
export async function openVolvoxGenome(
  driver: WebDriver,
  sequenceUrl: string,
): Promise<void> {
  await waitForStartScreen(driver)
  await clickButton(driver, 'Open new genome')
  await delay(1000)

  // The dialog opens on a drop zone. Switch to URL entry and paste the sequence
  // file, one url per line. The pane auto-detects the format and derives the
  // assembly name ("volvox") from the filename, so no manual name/format entry
  // is needed.
  await clickButton(driver, 'Open from a URL')
  await delay(500)

  // by testid, not by tag: MUI's multiline TextField renders a hidden shadow
  // textarea for sizing, and the recognition card below adds inputs of its own
  const urlInput = await driver.wait(
    until.elementLocated(By.css('[data-testid="genome-urls"]')),
    10000,
  )
  await urlInput.click()
  await urlInput.sendKeys(sequenceUrl)
  await delay(1000)

  const submitBtn = await driver.wait(
    until.elementLocated(By.css('[data-testid="open-sequence-submit"]')),
    10000,
  )
  await driver.wait(until.elementIsEnabled(submitBtn), 10000)
  await driver.executeScript('arguments[0].scrollIntoView(true);', submitBtn)
  await delay(500)
  await driver.executeScript('arguments[0].click();', submitBtn)
  await delay(3000)

  // A submit that took closes the dialog. One still open means handleOpen threw
  // and OpenSequenceDialog is showing its ErrorMessage, so read that text out —
  // dismissing it blind (the ESCAPE this used to send, which hung chromedriver
  // outright) only buried the cause under a later "no view launched" failure.
  const openDialogs = await countElements(driver, '.MuiDialog-root')
  console.log(`    DEBUG: ${openDialogs} dialogs open after submit`)
  if (openDialogs > 0) {
    const dialogs = await driver.findElements(By.css('.MuiDialog-root'))
    throw new Error(
      `Open genome dialog stayed open after submit: ${await dialogs[0]!.getText()}`,
    )
  }

  // Opening a new genome creates a session with no view; the empty session
  // shows a launcher. Click whatever launches a linear genome view, then ask the
  // SESSION whether a view actually appeared rather than assuming the click
  // took. The click lands on a button that renders while the new session is
  // still settling, and it silently does nothing often enough (roughly one run
  // in three) to have failed the run 90 seconds later at the import form, where
  // the symptom is an app bar with no view under it and no trace of the cause.
  for (let attempt = 1; ; attempt++) {
    const views = await driver.executeScript<number>(
      'return window.JBrowseSession?.views?.length ?? 0',
    )
    if (views > 0) {
      break
    }
    if (attempt > 3) {
      throw new Error('view launcher never produced a view after 3 clicks')
    }
    const launchButtons = await driver.findElements(
      By.xpath(
        "//button[contains(., 'Launch view') or contains(., 'Linear genome view')]",
      ),
    )
    console.log(
      `    DEBUG: launch attempt ${attempt}, ${launchButtons.length} buttons`,
    )
    if (launchButtons.length > 0) {
      await driver.executeScript('arguments[0].click();', launchButtons[0])
    }
    await delay(3000)
  }

  // The import form renders "Loading" until the assembly is ready, and an
  // assembly that never loads reports nothing: no error, no toast, just the
  // form. So gate on the assembly manager rather than on the button, and say
  // which assembly was still uninitialized if it never arrives.
  const assemblies = await waitFor<
    { name: string; initialized: boolean; error: string }[]
  >(
    driver,
    `return JSON.stringify((window.JBrowseRootModel?.assemblyManager?.assemblies ?? [])
       .map(a => ({ name: a.name, initialized: a.initialized, error: String(a.error ?? '') })))`,
    state => state.length > 0 && state.every(a => a.initialized || a.error),
    60000,
  )
  const failed = assemblies.filter(a => !a.initialized)
  if (assemblies.length === 0 || failed.length > 0) {
    throw new Error(
      `assembly never loaded: ${JSON.stringify(assemblies.length ? failed : 'none registered')}`,
    )
  }

  // The linear genome view import form shows a submit "Open" button that enables
  // once the assembly has loaded and a default region is selected.
  const openButton = await driver.wait(
    until.elementLocated(
      By.xpath("//button[@type='submit' and contains(., 'Open')]"),
    ),
    30000,
  )
  await driver.wait(until.elementIsEnabled(openButton), 30000)
  console.log('    DEBUG: import-form Open button enabled, clicking')
  await driver.executeScript('arguments[0].click();', openButton)
  await delay(2000)

  const searchInput = await driver.wait(
    until.elementLocated(By.css('input[placeholder="Search for location"]')),
    30000,
  )
  await clearInput(driver, searchInput)
  await searchInput.sendKeys('ctgA:1-10000')
  await searchInput.sendKeys(Key.ENTER)
  await delay(2000)

  await driver.wait(
    until.elementLocated(By.css('[data-testid="zoom_in"]')),
    10000,
  )
}

// Kill leftover chromedriver / electron processes from an earlier run.
//
// The patterns are deliberately narrow. `pkill -f jbrowse-desktop` matches any
// command line mentioning the product — a `pnpm start`, a packaging build, this
// harness's own wrapper shell — which in a shared checkout kills someone else's
// work, and `pkill -f chromedriver` even matched the `sh -c` running it and
// SIGTERMed itself (the source of a permanent "process cleanup failed" warning).
// The `[c]` form keeps the pattern from matching its own command line; the
// unpacked path keeps it to the app this harness launches.
const KILL_PATTERNS = [
  '[c]hromedriver',
  'unpacked/[j]browse-desktop-linux-x64/jbrowse-desktop',
]

export async function killProcesses(): Promise<void> {
  try {
    if (isWindows) {
      execSync('taskkill /F /IM chromedriver.exe 2>nul', { stdio: 'ignore' })
      execSync('taskkill /F /IM "jbrowse-desktop.exe" 2>nul', {
        stdio: 'ignore',
      })
    } else {
      for (const pattern of KILL_PATTERNS) {
        execSync(`pkill -f "${pattern}" || true`, { stdio: 'ignore' })
      }
    }
  } catch (e) {
    console.warn('    WARN: process cleanup failed:', e)
  }
  await delay(1000)
}
