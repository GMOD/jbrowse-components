// Films Chrome while the questions are typed into the real Claude side panel.
//
// **`waitIdle` BELOW IS KNOWN WRONG. Do not film with this as it stands.**
// Everything else here works: the typing lands, the panel drives the page, the
// frames are clean. What does not work is knowing when a turn ended. Watching
// the conversation column for pixel quiet fired 16s into turn 1 on both takes,
// so the harness typed turn 2 over a turn still in progress. The panel streams
// in bursts with long gaps, so "quiet" and "done" are not the same thing and a
// longer threshold only makes the wrong answer slower. Solve that first —
// agent-docs/todo/land-the-agent-client-demo-videos.md.
//
// Nothing here is an API into the panel: the questions go in on the keyboard
// and the answers are whatever the extension does with them. The panel is a
// chrome-extension:// page, so the extension's own javascript_tool cannot read
// it either — host permissions are http/https. The composer is cropped out of
// the idle check because its caret blinks forever and would read as work.
//
// Frames come from `screencapture -l`, which takes the window rather than a
// screen region — Chrome sits on its own Mission Control space here, and a
// region capture of the space the harness runs on is a picture of the desktop.
//
// Input is split because neither half can do the job alone: System Events
// cannot click (-25211), and CGEvent unicode keystrokes do not reach the
// panel. So CGEvent lands the focus and System Events types into it.
import { execFile, execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const outDir = process.argv[2] ?? path.join(process.cwd(), 'panel-demo')
const framesDir = path.join(outDir, 'frames')
fs.mkdirSync(framesDir, { recursive: true })

const HERE = path.dirname(new URL(import.meta.url).pathname)

// The two Swift helpers are compiled on demand rather than committed: they are
// build output, and a stale one is worse than a two-second build.
function helper(name) {
  const bin = path.join(HERE, name)
  if (!fs.existsSync(bin)) {
    execFileSync(
      'swiftc',
      ['-O', path.join(HERE, `${name}.swift`), '-o', bin],
      {
        stdio: 'inherit',
      },
    )
  }
  return bin
}
const CHROME = process.env.DEMO_CHROME_APP ?? 'Google Chrome'
const START = process.env.DEMO_START_URL ?? 'https://jbrowse.org/code/jb2/main/'
const WIN = { x: 96, y: 60, w: 1600, h: 960 }
const COMPOSER = { x: 1409, y: 871 }
// the conversation column in capture pixels, composer excluded
const CONVO = { top: 250, left: 2460, w: 740, h: 1400 }

const TURNS =
  process.argv[3] === 'rehearse'
    ? [
        'This page is JBrowse, a genome browser. It puts its live session on window.JBrowseSession. Read it and tell me which assemblies are configured and how many views are open.',
      ]
    : [
        'This page is JBrowse, a genome browser. It puts its live MobX-State-Tree session on window.JBrowseSession, so you can drive it with JavaScript instead of clicking. Open hg38 at CDKN1A, with the RefSeq genes track and both vertebrate conservation tracks turned on.',
        'Add the four human ATAC-seq samples from GEO series GSE217032 - two DMSO vehicle, two Nutlin-3a - as one stacked multi-wiggle track.',
        'Zoom to about 20kb around the biggest nutlin-versus-vehicle difference, then check that every track really drew rather than trusting the picture.',
      ]

const delay = ms => new Promise(r => setTimeout(r, ms))
const osa = s =>
  execFileSync('osascript', ['-e', s], { encoding: 'utf8' }).trim()
const input = (...a) =>
  execFileSync(helper('inputtool'), a.map(String), { encoding: 'utf8' })

// One keystroke event per word. A whole sentence in one event comes out
// reordered — the first take of this read "This page. isJBrowse" on camera.
const esc = s => s.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
async function typeChunked(text) {
  const words = text.split(' ')
  for (const [i, w] of words.entries()) {
    const piece = i === words.length - 1 ? w : `${w} `
    osa(`tell application "System Events" to keystroke "${esc(piece)}"`)
    await delay(45)
  }
}

function stagedWindowId() {
  const out = execFileSync(helper('windowlist'), { encoding: 'utf8' })
  for (const line of out.split('\n')) {
    const [num, on, bounds, owner] = line.split('\t')
    if (
      owner === CHROME &&
      on === 'on ' &&
      bounds === `${WIN.x},${WIN.y},${WIN.w},${WIN.h}`
    ) {
      return num
    }
  }
  throw new Error('staged Chrome window not found')
}

const shot = (id, file) =>
  new Promise(r =>
    execFile(
      '/usr/sbin/screencapture',
      ['-x', '-o', '-t', 'jpg', '-l', id, file],
      () => {
        r()
      },
    ),
  )

function convoKey(file) {
  const crop = file.replace(/\.jpg$/, '.c.jpg')
  try {
    execFileSync(
      '/usr/bin/sips',
      [
        '-c',
        String(CONVO.h),
        String(CONVO.w),
        '--cropOffset',
        String(CONVO.top),
        String(CONVO.left),
        '-Z',
        '260',
        file,
        '--out',
        crop,
      ],
      { stdio: 'ignore' },
    )
    const key = crypto
      .createHash('sha1')
      .update(fs.readFileSync(crop))
      .digest('hex')
    fs.unlinkSync(crop)
    return key
  } catch {
    return null
  }
}

const frames = []
const captions = []
let capIdx = -1
// an object rather than a bare let: the camera loop and the shutdown below
// run in different async contexts, and flow analysis reads a local boolean as
// never reassigned
const filming = { on: true }
const pushCaption = (question, status) => {
  captions.push({ question, status })
  capIdx = captions.length - 1
}

try {
  osa(`tell application "${CHROME}" to make new window`)
  osa(
    `tell application "${CHROME}" to set URL of active tab of window 1 to "${START}"`,
  )
  osa(
    `tell application "${CHROME}" to set bounds of window 1 to {${WIN.x}, ${WIN.y}, ${WIN.x + WIN.w}, ${WIN.y + WIN.h}}`,
  )
  osa(`tell application "${CHROME}" to activate`)
  await delay(7000)

  const winId = stagedWindowId()
  console.log(`window ${winId}`)
  pushCaption(TURNS[0], 'opening the Claude side panel')

  osa('tell application "System Events" to keystroke "e" using command down')
  await delay(4000)
  // a fresh conversation, and the two account notices out of the frame: one of
  // them names the weekly usage left on the account being filmed
  input('click', 1628, 208)
  await delay(1500)
  input('click', 1663, 723)
  await delay(600)
  input('click', 1663, 789)
  await delay(800)
  await shot(stagedWindowId(), path.join(outDir, 'stage-check.jpg'))

  const cameraLoop = (async () => {
    const t0 = Date.now()
    let n = 0
    while (filming.on) {
      const file = path.join(framesDir, `f${String(n++).padStart(5, '0')}.jpg`)
      const at = Date.now() - t0
      const idx = capIdx
      await shot(winId, file)
      if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
        frames.push({ file, t: at, cap: idx })
      }
      await delay(150)
    }
  })()

  async function waitIdle({ quietMs, maxMs, label }) {
    const started = Date.now()
    const probe = path.join(outDir, 'probe.jpg')
    let lastKey = null
    let lastChange = Date.now()
    while (Date.now() - started < maxMs) {
      await shot(winId, probe)
      const key = convoKey(probe)
      if (key !== lastKey) {
        lastKey = key
        lastChange = Date.now()
      }
      if (Date.now() - lastChange > quietMs) {
        console.log(
          `  [${label} idle after ${((Date.now() - started) / 1000).toFixed(0)}s]`,
        )
        return true
      }
      await delay(1500)
    }
    console.log(`  [${label} hit the ${maxMs / 1000}s ceiling]`)
    return false
  }

  for (const [i, turn] of TURNS.entries()) {
    console.log(`\n=== ${turn.slice(0, 90)}`)
    pushCaption(turn, 'typing into the side panel')
    input('click', WIN.x + COMPOSER.x, WIN.y + COMPOSER.y)
    await delay(700)
    input('key', 0, 'cmd')
    await delay(250)
    input('key', 51)
    await delay(500)
    await typeChunked(turn)
    await delay(1500)
    pushCaption(turn, 'sent')
    input('key', 36)
    await delay(6000)
    pushCaption(turn, 'Claude is working in the page')
    await waitIdle({ quietMs: 15000, maxMs: 480000, label: `turn ${i + 1}` })
    pushCaption(turn, 'turn complete')
    await delay(i === TURNS.length - 1 ? 6000 : 3000)
  }

  filming.on = false
  await cameraLoop
  fs.writeFileSync(
    path.join(outDir, 'timeline.json'),
    JSON.stringify({ captions, frames }, null, 2),
  )
  console.log(`\n${frames.length} frames -> ${outDir}`)
} finally {
  filming.on = false
  await delay(400)
}
