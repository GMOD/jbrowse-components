// Driving Claude Code inside the Claude desktop app (Claude.app), for the
// takes that film the GUI client rather than the TUI. recordDemoApp.mjs is the
// take runner; this file is everything specific to the app.
//
// The app gives none of the three CLI flags a take relies on: no
// --append-system-prompt (the take's SYSTEM becomes <cwd>/CLAUDE.md), no
// --allowedTools (the permission mode is the equivalent) and no
// --mcp-config/--strict-mcp-config, so the MCP server has to go in the app's
// own config file and the session sees the user's other connectors too.
//
// Nothing here reads a hardcoded screen coordinate. Every click is derived
// from the window frame the window server reports, because the layout moves
// with the window width AND with whether the sidebar is open.
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { delay } from './demoCore.mjs'
import { findWindow, helper, osa, windowList } from './macTools.mjs'

const APP = 'Claude'
const DESKTOP_CONFIG = path.join(
  process.env.HOME,
  'Library/Application Support/Claude/claude_desktop_config.json',
)
// left behind on purpose if a take crashes: restoring it is a one-line mv, and
// silently having overwritten the user's connector list is worse
const CONFIG_BACKUP = `${DESKTOP_CONFIG}.take-backup`

// The app reads claude_desktop_config.json at LAUNCH and spawns one child per
// surface, so proving the server loaded is `pgrep`, not a model turn. Nothing
// else reaches Claude Code sessions in the app: a user-scope entry in
// ~/.claude.json is ignored, a project .mcp.json is ignored, and `/mcp` opens
// the connector Directory (a remote marketplace a local server is never in).
export function installMcpServer(serverPath) {
  if (!fs.existsSync(CONFIG_BACKUP)) {
    fs.copyFileSync(DESKTOP_CONFIG, CONFIG_BACKUP)
  }
  const config = JSON.parse(fs.readFileSync(DESKTOP_CONFIG, 'utf8'))
  config.mcpServers = {
    ...config.mcpServers,
    jbrowse: { command: process.execPath, args: [serverPath] },
  }
  fs.writeFileSync(DESKTOP_CONFIG, JSON.stringify(config, null, 2))
}

export function restoreMcpServer() {
  if (fs.existsSync(CONFIG_BACKUP)) {
    fs.copyFileSync(CONFIG_BACKUP, DESKTOP_CONFIG)
    fs.rmSync(CONFIG_BACKUP, { force: true })
  }
}

export function mcpServerLoaded(serverPath) {
  try {
    return execFileSync('pgrep', ['-f', serverPath], { encoding: 'utf8' })
      .split('\n')
      .some(Boolean)
  } catch {
    return false
  }
}

export const quitApp = () => {
  try {
    osa(`tell application "${APP}" to quit`)
  } catch {}
}

// A fixed sleep after `quit` is not enough, and the cost is invisible: the
// deep link then only FOCUSES the still-running app, which starts a session in
// whatever workspace it already had. A take filmed that way runs against
// someone else's folder and looks fine on screen. Poll instead.
export async function quitAndWait(timeoutMs = 25_000) {
  quitApp()
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (
      spawnSync('pgrep', ['-f', '/Applications/Claude.app/Contents/MacOS'])
        .status !== 0
    ) {
      return true
    }
    await delay(1000)
  }
  return false
}

export const activateApp = () => {
  osa(`tell application "${APP}" to activate`)
}

// A CGEvent click lands on whatever is under the point, so a take that clicks
// while the terminal is in front types its prompt into the terminal. Every
// click goes through here.
//
// The pause after activating is not politeness: macOS spends a click on an
// inactive window's activation, so a click issued in the same breath as
// `activate` is swallowed and the control never fires — which reads as a
// control that does not respond.
async function click(x, y) {
  activateApp()
  await delay(400)
  execFileSync(helper('inputtool'), ['click', String(x), String(y)])
}

const key = (code, ...mods) =>
  execFileSync(helper('inputtool'), ['key', String(code), ...mods])

const RETURN = 36
const ESCAPE = 53

// The app's own window, told apart from its half-dozen offscreen helpers: the
// helpers are 500x500 and 800x600 and carry no title, and the menu bar
// extras are 24px tall.
export function appWindow() {
  return windowList().find(
    w =>
      w.owner === APP &&
      w.onscreen &&
      w.title === APP &&
      w.w > 600 &&
      w.h > 600,
  )
}

export async function waitForWindow(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const win = appWindow()
    if (win) {
      return win
    }
    await delay(1000)
  }
  throw new Error('the Claude app never opened a window')
}

// `claude://code/new?folder=…` is the app's own Finder quick action, so it is
// the one entry point that starts a session in a named folder without
// clicking through the GUI.
export function openSession(folder) {
  execFileSync('open', [
    `claude://code/new?folder=${encodeURIComponent(folder)}&source=services`,
  ])
}

export function shot(win, file) {
  execFileSync('/usr/sbin/screencapture', [
    '-x',
    '-o',
    '-l',
    String(win.id),
    file,
  ])
  return file
}

// screencapture writes backing-store pixels; every rect below is in window
// points, so the scale has to come off the image rather than be assumed 2.
function imageScale(file, win) {
  const width = Number(
    execFileSync('sips', ['-g', 'pixelWidth', file], { encoding: 'utf8' })
      .split(':')
      .at(-1),
  )
  return width / win.w
}

const magick = args => execFileSync('magick', args, { encoding: 'utf8' }).trim()

// One perceptual hash of a small region, in window points. Used for "is this
// the send arrow or the stop square", which is the only reliable turn signal
// the GUI gives: there is no transcript on disk to tail and no pane to capture.
function regionHash(file, win, rect) {
  const s = imageScale(file, win)
  const geometry = `${Math.round(rect.w * s)}x${Math.round(rect.h * s)}+${Math.round(rect.x * s)}+${Math.round(rect.y * s)}`
  return magick([file, '-crop', geometry, '+repage', '-format', '%#', 'info:'])
}

// One pixel, in window points. The sidebar panel is exactly one step lighter
// than the page behind it, which is the whole difference this reads.
function pixelLevel(file, win, point) {
  const s = imageScale(file, win)
  return Number(
    magick([
      file,
      '-crop',
      `1x1+${Math.round(point.x * s)}+${Math.round(point.y * s)}`,
      '+repage',
      '-format',
      '%[fx:int(255*r)]',
      'info:',
    ]),
  )
}

/**
 * The centre of the one filled white control on screen, in window points.
 *
 * This is how the trust modal's confirm button is found, instead of an offset
 * from the window centre: the modal grows with the length of the folder path it
 * names, so a take in a deep directory puts its buttons ~20 points below where
 * a take in a short one does, and a fixed offset clicks the gap under them —
 * silently, since the modal simply stays up. Nothing else in this dark UI is a
 * filled white rectangle of button size.
 */
function whiteControl(file, win) {
  const report = magick([
    file,
    '-threshold',
    '80%',
    '-define',
    'connected-components:verbose=true',
    '-define',
    'connected-components:area-threshold=2000',
    '-connected-components',
    '8',
    'null:',
  ])
  const s = imageScale(file, win)
  const blobs = report
    .split('\n')
    .map(line =>
      /^\s*(\d+):\s+(\d+)x(\d+)\+(\d+)\+(\d+)\s+([\d.]+),([\d.]+)\s+(\d+)/.exec(
        line,
      ),
    )
    .filter(m => m && m[1] !== '0')
    .map(m => ({
      w: Number(m[2]) / s,
      h: Number(m[3]) / s,
      x: Number(m[6]) / s,
      y: Number(m[7]) / s,
      area: Number(m[8]),
    }))
    // button-shaped and in the middle of the window, so a stray light panel
    // elsewhere cannot be mistaken for it
    .filter(
      b =>
        b.w > 60 &&
        b.w < 250 &&
        b.h > 14 &&
        b.h < 40 &&
        b.y > win.h * 0.2 &&
        b.y < win.h * 0.8,
    )
    .sort((a, b) => b.area - a.area)
  // the empty case spelled out, like findWindow's: indexing an array is typed
  // as always finding something, and every caller here has to handle a modal
  // that is not up
  return blobs.length > 0 ? blobs[0] : undefined
}
const SIDEBAR_TOGGLE = { x: 96, y: 24 }
const COMPOSER = win => ({ x: win.w * 0.5, y: win.h - 64 })
// The close glyph sits at the banner box's own top right, and the box is
// taller when it carries a button and two lines (the weekly-usage warning) than
// when it carries one (a model promo) — so there is no single offset. Measured:
// 108 for a one-line banner, 154 for the usage warning.
const BANNER_CLOSE_OFFSETS = [108, 154, 200]
const BANNER_CLOSE = (win, dy) => ({ x: win.w - 62, y: win.h - dy })
const MODEL_PICKER = win => ({ x: win.w - 137, y: win.h - 22 })
// The conversation, without the title bar above it or the composer and banner
// strip below: what changes while a turn runs, and nothing that changes while
// a prompt is being typed into it.
//
// NOT the send button. It looked like the obvious signal — the TUI has a
// spinner, so the GUI should have a stop square — but the app keeps the same
// send arrow for the whole turn, and two captures of it ten minutes apart
// differ by a one-pixel shift, so an equality test on it never settles and
// never fires. Cost a filmed take on 2026-09-08.
const CONVERSATION = win => ({
  x: 0,
  y: 60,
  w: win.w,
  h: win.h - 190,
})
// Far left, half way down. The sidebar panel is DARKER than the content it
// covers — 17 against 21 — which is the opposite of what a first calibration
// concluded, and getting it backwards means this reports "already collapsed"
// over an open sidebar and never clicks: the account email and every past
// session title then film. Confirmed by scanning a row: 17 out to x=288, 21
// beyond it, which is the sidebar's own width.
const SIDEBAR_PROBE = win => ({ x: 10, y: win.h / 2 })
const SIDEBAR_CONTENT_LEVEL = 19

const at = (win, point) => [win.x + point.x, win.y + point.y]

// The modal dims the page behind it and its own box is several steps lighter,
// so the centre pixel says whether it is up. Worth knowing rather than
// assuming: the modal appearing is ALSO the proof that the deep link opened a
// new workspace instead of focusing a running app that already had one.
// The modal appearing is ALSO the proof that the deep link opened a new
// workspace rather than focusing a running app that already had one, so its
// absence is a reason to stop rather than a step to skip.
export function trustButton(win, scratch, name = 'trust-probe') {
  return whiteControl(shot(win, path.join(scratch, `${name}.png`)), win)
}

/**
 * Answers 'absent', 'stuck' or 'dismissed', because those need different
 * remedies: absent means this session is not in the take folder, stuck means
 * the click missed.
 *
 * Cancel is the focused button, so a synthetic Return abandons the session —
 * and the modal reappears on EVERY launch, including for a folder trusted
 * minutes earlier, so this is not a first-run step.
 */
export async function dismissTrust(win, scratch, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  let button = trustButton(win, scratch)
  while (!button && Date.now() < deadline) {
    await delay(1500)
    button = trustButton(win, scratch)
  }
  if (!button) {
    return 'absent'
  }
  await click(...at(win, button))
  await delay(2500)
  return trustButton(win, scratch, 'trust-after') ? 'stuck' : 'dismissed'
}

// The sidebar carries the account email and every past session title, so it
// has to be shut — but it is a persisted toggle rather than a per-launch
// default (sidebarMode in the app config is WHICH sidebar, not whether), so
// blind-toggling opens it as often as it closes it. Probe, toggle, re-probe.
export async function collapseSidebar(win, scratch) {
  const open = () =>
    pixelLevel(
      shot(win, path.join(scratch, 'sidebar-probe.png')),
      win,
      SIDEBAR_PROBE(win),
    ) < SIDEBAR_CONTENT_LEVEL
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!open()) {
      return true
    }
    await click(...at(win, SIDEBAR_TOGGLE))
    await delay(2500)
  }
  return !open()
}

// Banners arrive unbidden and each one eats a strip of the composer: a
// notifications-off toast, a model promo, and an "approaching weekly usage
// limit" warning that also puts the reset date on camera. Called before
// filming and between turns.
export async function dismissBanners(win, scratch, rounds = 3) {
  const strip = () =>
    regionHash(shot(win, path.join(scratch, 'banner-probe.png')), win, {
      x: 0,
      y: win.h - 190,
      w: win.w,
      h: 130,
    })
  for (let i = 0; i < rounds; i++) {
    const before = strip()
    let dismissed = false
    for (const dy of BANNER_CLOSE_OFFSETS) {
      await click(...at(win, BANNER_CLOSE(win, dy)))
      await delay(1200)
      if (strip() !== before) {
        dismissed = true
        break
      }
    }
    if (!dismissed) {
      return
    }
  }
}

// The menu lists its models with digit accelerators (Fable 5.1 1, Opus 5 2,
// Sonnet 5 3, Haiku 4.5 4), so the choice needs no coordinate of its own.
// The menu opens upward from the picker, so its rows are measured UP from the
// window bottom in points: topmost model 157.5 above it, 24 a row. Measuring
// these off a screenshot in PIXELS and using them as points put every click two
// rows out — which selected Fable, rate-limited on the account being filmed, so
// nothing changed and the failure read as a missed click.
const MODEL_ROW_BASE = 157.5
const MODEL_ROW_STEP = 24
const modelRowY = (win, row) => win.h - (MODEL_ROW_BASE - row * MODEL_ROW_STEP)
// the tick beside the current model: the one blue thing in the menu, and a
// direct read of which model is selected rather than an inference from change
const MODEL_CHECK = (win, row) => ({
  x: win.w - 135,
  y: modelRowY(win, row) - 8,
  w: 20,
  h: 16,
})
const CHECK_BLUE_LEAD = 3

// How far the averaged region's blue runs ahead of its red, in thousandths.
// The tick reads +7 and an unticked row -3, so the sign is the signal.
function blueLead(file, win, rect) {
  const s = imageScale(file, win)
  return Number(
    magick([
      file,
      '-crop',
      `${Math.round(rect.w * s)}x${Math.round(rect.h * s)}+${Math.round(rect.x * s)}+${Math.round(rect.y * s)}`,
      '+repage',
      '-scale',
      '1x1',
      '-format',
      '%[fx:int(1000*(b-r))]',
      'info:',
    ]),
  )
}

/**
 * Choose a model, and answer whether it actually changed.
 *
 * The digit accelerators the menu prints did NOT take when typed, and the
 * failure is silent: the menu closes, the label keeps its old value, and four
 * turns get filmed on whatever was already selected. So this clicks the row and
 * then reads the label back.
 *
 * Row geometry: the menu opens upward from the picker, one row per model with
 * the list ending above a Fast-mode footer, so a row is addressed from the
 * bottom of the menu rather than the top.
 */
export async function selectModel(win, scratch, row) {
  const ticked = (name, r = row) =>
    blueLead(shot(win, path.join(scratch, name)), win, MODEL_CHECK(win, r)) >
    CHECK_BLUE_LEAD
  await click(...at(win, MODEL_PICKER(win)))
  await delay(1500)
  // Anchored to the picker, so measured UP from the window bottom in points:
  // 24 points a row, topmost model 216 above the bottom. Measuring these off a
  // screenshot in PIXELS and using them as points put every click one row low,
  // which selected the model that was already current — so the label did not
  // change and the verification below read as "the click missed".
  // already selected is success, not a no-op to be retried: the app remembers
  // the choice between launches, so a second take would otherwise report the
  // model unchanged and refuse to film
  if (ticked('model-menu.png')) {
    key(ESCAPE)
    await delay(600)
    return true
  }
  await click(...at(win, { x: win.w - 160, y: modelRowY(win, row) }))
  await delay(1800)
  await click(...at(win, MODEL_PICKER(win)))
  await delay(1500)
  const ok = ticked('model-menu-after.png')
  key(ESCAPE)
  await delay(600)
  return ok
}

export function placeWindow(frame) {
  osa(`tell application "System Events" to tell process "${APP}" to tell window 1
         set position to {${frame.x}, ${frame.y}}
         set size to {${frame.w}, ${frame.h}}
       end tell`)
}

export async function typePrompt(win, text, perChunkMs = 90) {
  await click(...at(win, COMPOSER(win)))
  await delay(600)
  const chunk = 4
  for (let i = 0; i < text.length; i += chunk) {
    execFileSync(helper('inputtool'), ['type', text.slice(i, i + chunk)])
    await delay(perChunkMs)
  }
  await delay(500)
  key(RETURN)
}

export function conversationHash(win, scratch, name = 'turn-probe') {
  return regionHash(
    shot(win, path.join(scratch, `${name}.png`)),
    win,
    CONVERSATION(win),
  )
}

/**
 * Whether the turn has finished, from the conversation pane going still.
 *
 * The same state machine demoCore.waitTurnDone runs against a tmux pane, for
 * the same reason: the pane changes the instant a prompt is typed, so
 * stillness ALONE declares a turn finished before the model has started it.
 * Working has to be seen first. `grace` is the escape hatch for a turn whose
 * change was never caught, and the cap is the TUI harness's, since turn one of
 * a take can carry a whole-genome alignment.
 *
 * Every sample is logged: with no transcript on disk and no pane to capture,
 * this log is the only evidence for why a turn was called done.
 */
export async function waitTurnDone(
  win,
  scratch,
  {
    before,
    log,
    intervalMs = 1500,
    floorMs = 15_000,
    capMs = 2_400_000,
    graceMs = 120_000,
    settleSamples = 8,
  },
) {
  const started = Date.now()
  const graceUntil = started + graceMs
  let last = before
  let sawWorking = false
  let still = 0
  while (Date.now() - started < capMs) {
    await delay(intervalMs)
    const hash = conversationHash(win, scratch)
    const changed = hash !== last
    if (changed) {
      sawWorking = true
      still = 0
    } else if (sawWorking || Date.now() > graceUntil) {
      still += 1
    }
    last = hash
    if (log) {
      fs.appendFileSync(
        log,
        `${Math.round((Date.now() - started) / 1000)}s ${changed ? 'change' : 'still'} still=${still} working=${sawWorking} ${hash.slice(0, 12)}\n`,
      )
    }
    if (
      still >= settleSamples &&
      Date.now() - started > floorMs &&
      hash !== before
    ) {
      return true
    }
  }
  return false
}

export { findWindow }
