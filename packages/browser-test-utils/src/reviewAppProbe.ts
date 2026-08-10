// Drives the shared React review client (reviewApp/) in a real browser, against
// a stubbed fetch and the two-button card in reviewApp/probeFixture.tsx, and
// asserts the properties that only a driven browser can see:
//
//   1. a press SHOWS for as long as its write is in flight,
//   2. what the card settles on is whatever the server said, not the click,
//   3. the repaint that confirms a verdict does not throw the reviewer out of
//      the note they started typing after clicking it, and
//   4. a single click on Approve records a single verdict — the "I have to click
//      Approve twice" complaint, asserted directly.
//
// All four live in the gap between a mousedown and a write returning, so nothing
// jest can reach observes them, and the string-rendering client this replaced
// lost three of them at least once each. They are structural now — a reconciler
// keeps node identity, so the button survives its own click and the textarea
// keeps its caret — which is exactly why they are worth pinning: a regression
// here would mean something reintroduced a wholesale repaint.
//
// Run it: node --experimental-strip-types src/reviewAppProbe.ts
// It exits non-zero on a failure and prints what each case settled on.
import path from 'node:path'

import puppeteer from 'puppeteer'

import { buildReviewPage } from './reviewBundle.ts'

import type { Page } from 'puppeteer'

const bundle = await buildReviewPage({
  entry: path.resolve(import.meta.dirname, 'reviewApp', 'probeFixture.tsx'),
  title: 'review client probe',
  favicon: '🔬',
})

// The stub is a classic script and the page is a module, so the stub is
// installed before any React code runs.
function pageHtml(fetchStub: string) {
  return `<!doctype html><html><body>
<div id="root"></div>
<script>${fetchStub}</script>
<script type="module">${bundle.js}</script>
</body></html>`
}

// Echoes back the status it was posted, so two writes queued for one card can be
// told apart, and counts the writes so a doubled one is visible. `delay` stands
// in for the several hundred ms a write really takes while a page load's worth
// of figures is still streaming.
const echoStub = (delay: number) => `window.__writes = []
let seq = 0
window.fetch = (url, opts) => {
  const sent = JSON.parse(opts.body).status
  window.__writes.push(sent)
  const at = 'T' + ++seq
  return new Promise(r => setTimeout(() => r({
    ok: true, status: 200,
    json: () => Promise.resolve({ status: sent, note: '', reviewedAt: at, hash: 'h' }),
  }), ${delay}))
}`

const refusedStub = `window.fetch = () => new Promise(r => setTimeout(() => r({
  ok: false, status: 400,
  json: () => Promise.resolve({ error: 'no image on disk' }),
}), 150))`

const conflictStub = `window.fetch = () => new Promise(r => setTimeout(() => r({
  ok: false, status: 409,
  json: () => Promise.resolve({
    reason: 'verdict', current: { status: 'good', note: '', reviewedAt: 'T9' },
    stale: false, imageHash: 'h',
  }),
}), 150))`

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
})

const failures: string[] = []

function check(name: string, ok: boolean, detail: string) {
  if (!ok) {
    failures.push(name)
  }
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
  console.log(`       ${detail}`)
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

async function open(fetchStub: string) {
  const page = await browser.newPage()
  await page.setContent(pageHtml(fetchStub))
  await page.waitForSelector('.approve')
  return page
}

// Which button the card is currently showing as pressed.
function pressedIn(page: Page) {
  return page.evaluate(() => {
    const on = (sel: string) =>
      !!document.querySelector(sel)?.classList.contains('active')
    return on('.approve') ? 'approve' : on('.deny') ? 'deny' : 'neither'
  })
}

const cardMessage = (page: Page) =>
  page.evaluate(() => document.querySelector('.cardmsg')?.textContent ?? '')

// ---------------------------------------------------------------------------
// 1. the press shows for the whole round trip
// ---------------------------------------------------------------------------
{
  const page = await open(echoStub(400))
  const box = await (await page.$('.deny'))?.boundingBox()
  if (!box) {
    throw new Error('the probe page rendered no deny button')
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.up()

  let blankAt = -1
  for (let t = 25; t < 350; t += 25) {
    await wait(25)
    if (blankAt < 0 && (await pressedIn(page)) !== 'deny') {
      blankAt = t
    }
  }
  check(
    'the press shows while the write is in flight',
    blankAt < 0,
    blankAt < 0
      ? 'pressed for the whole 350ms the write was outstanding'
      : `went back to unpressed at ${blankAt}ms, with the write still outstanding`,
  )
  await page.close()
}

// ---------------------------------------------------------------------------
// 2. the recorded press is only ever a placeholder: the server decides what a
//    settled card says
// ---------------------------------------------------------------------------
{
  const page = await open(refusedStub)
  await page.click('.deny')
  await wait(400)
  const pressed = await pressedIn(page)
  const msg = await cardMessage(page)
  check(
    'a refused write (400) leaves no press behind',
    pressed === 'neither' && msg.startsWith('Not saved'),
    `pressed: ${pressed}; card says: ${msg.slice(0, 48)}`,
  )
  await page.close()
}
{
  const page = await open(conflictStub)
  await page.click('.deny')
  await wait(400)
  const pressed = await pressedIn(page)
  check(
    "a conflict (409) shows the server's verdict, not the click",
    pressed === 'approve',
    `pressed: ${pressed} (the server holds 'good'; the click was Deny)`,
  )
  await page.close()
}
{
  const page = await open(echoStub(300))
  await page.click('.deny')
  await page.click('.approve')
  await wait(900)
  const pressed = await pressedIn(page)
  check(
    'two clicks in flight settle on the second',
    pressed === 'approve',
    `pressed: ${pressed}`,
  )
  await page.close()
}

// ---------------------------------------------------------------------------
// 3. the repaint that confirms the verdict lands mid-sentence, because typing
//    the reason straight after clicking Deny is the flow the card is built for
// ---------------------------------------------------------------------------
{
  const page = await open(echoStub(350))
  await page.click('.deny')
  await page.focus('.note')
  await page.keyboard.type('the labels overlap here')
  // caret parked mid-sentence, as a reviewer rereading what they wrote
  await page.evaluate('document.querySelector(".note").setSelectionRange(4, 4)')
  // the write is still outstanding; let it land and repaint the card
  await wait(700)
  await page.keyboard.type('XYZ')
  const box = await page.evaluate(() => {
    const note = document.querySelector('.note') as HTMLTextAreaElement | null
    return {
      text: note?.value ?? '',
      focused: document.activeElement === note,
      caret: note?.selectionStart ?? -1,
    }
  })
  check(
    'the confirming repaint keeps the caret in the note being typed',
    box.focused && box.text.includes('XYZ'),
    box.text.includes('XYZ')
      ? `still focused, caret ${box.caret}, text kept: ${JSON.stringify(box.text)}`
      : `focus lost — the keystrokes after the repaint went nowhere: ${JSON.stringify(box.text)}`,
  )
  await page.close()
}

// ---------------------------------------------------------------------------
// 4. the complaint itself: one click on Approve, one verdict. The note field's
//    blur fires inside the click that caused it, so a note save is in flight
//    during the very click that triggered it — the window in which the old
//    client destroyed the button the pointer was on and the browser dispatched
//    no click at all.
// ---------------------------------------------------------------------------
{
  const page = await open(echoStub(120))
  // Approve first, so the entry HAS a verdict — a note has nothing to attach to
  // until it does, and without one the blur posts nothing and this case does not
  // reach the window it is about.
  await page.click('.approve')
  await wait(400)
  await page.focus('.note')
  await page.keyboard.type('a reason')
  const box = await (await page.$('.deny'))?.boundingBox()
  if (!box) {
    throw new Error('the probe page rendered no deny button')
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  // the blur's note save is issued here, on the mousedown, and lands well
  // inside the ~80ms a real click is held
  await wait(80)
  await page.mouse.up()
  await wait(800)
  const writes = await page.evaluate(
    () => (window as unknown as { __writes: string[] }).__writes,
  )
  const pressed = await pressedIn(page)
  const msg = await cardMessage(page)
  check(
    'typing a note then clicking Deny once records the denial',
    pressed === 'deny' && writes.at(-1) === 'bad' && msg === '',
    `pressed: ${pressed}; writes posted: ${JSON.stringify(writes)}; card says: ${JSON.stringify(msg)}`,
  )
  await page.close()
}

await browser.close()
if (failures.length) {
  console.log(`\n${failures.length} failing:\n  ${failures.join('\n  ')}`)
  process.exitCode = 1
} else {
  console.log('\nall React review-client properties hold')
}
