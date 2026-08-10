// Drives the shared review client (reviewClient.ts) in a real browser, against
// a stubbed fetch and a two-button card, and asserts the three properties that
// only a driven browser can see:
//
//   1. a press SHOWS for as long as its write is in flight,
//   2. what the card settles on is whatever the server said, not the click, and
//   3. the repaint that confirms a verdict does not throw the reviewer out of
//      the note they started typing after clicking it.
//
// All three live in the gap between a mousedown and a write returning, so
// nothing jest can reach observes them, and the review UIs have now lost each of
// them once. The first regressed silently and invisibly: the press was painted
// onto the button and left there, correct until a repaint deferred by that same
// press flushed the instant the click was dispatched and rendered the card back
// from `data` — several hundred ms before the write it was waiting on. The
// reviewer sees an unpressed button and clicks again, which is the "I have to
// click Approve twice" complaint, arriving through the machinery added to fix
// it. The third is quieter still: the text already typed was carried across the
// swap, so nothing looked lost — but focus went to <body> and every keystroke
// after that was dropped while the reviewer watched the box they were typing in.
//
// Run it: node --experimental-strip-types src/reviewClientProbe.ts
// It exits non-zero on a failure and prints what each case settled on.
import puppeteer from 'puppeteer'

import { reviewClientScript } from './reviewClient.ts'

import type { Page } from 'puppeteer'

const CLIENT = reviewClientScript({
  draftsKey: 'review-client-probe',
  imageMovedPhrase: 'it moved',
})

// The smallest page satisfying the client's contract: a card with the two
// verdict buttons, a .note, an .unsaved flag and a .cardmsg, plus renderCard and
// renderCounts as function declarations.
function pageHtml(fetchStub: string) {
  return `<!doctype html><html><body>
<main id="main"></main>
<script>
${fetchStub}

${CLIENT}

function renderCard(e) {
  const st = e.verdict ? e.verdict.status : 'none'
  return '<div class="card" data-name="' + e.name + '">' +
    '<button class="approve' + (st === 'good' ? ' active' : '') + '" onclick="setVerdict(this,\\'good\\')">A</button>' +
    '<button class="deny' + (st === 'bad' ? ' active' : '') + '" onclick="setVerdict(this,\\'bad\\')">D</button>' +
    '<textarea class="note" onchange="saveNote(this)"></textarea>' +
    '<span class="unsaved"></span>' +
    '<div class="' + msgClass(e.name) + '">' + esc(messageText(e.name)) + '</div>' +
  '</div>'
}
function renderCounts() {}

data = [{ name: 'x', imageHash: 'h', verdict: undefined }]
$('#main').innerHTML = data.map(renderCard).join('')
</script>
</body></html>`
}

// Echoes back the status it was posted, so two writes queued for one card are
// telling apart. `delay` stands in for the several hundred ms a write really
// takes while a page load's worth of figures is still streaming.
const echoStub = (delay: number) => `let seq = 0
window.fetch = (url, opts) => {
  const sent = JSON.parse(opts.body).status
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

async function open(fetchStub: string) {
  const page = await browser.newPage()
  await page.setContent(pageHtml(fetchStub))
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
// 1. the press shows for the whole round trip, including with a repaint that
//    this very press stranded — which is the note-then-Deny case the deferral
//    machinery exists for, and so the one where it matters most
// ---------------------------------------------------------------------------
for (const strand of [false, true]) {
  const page = await open(echoStub(400))
  const box = await (await page.$('.deny'))?.boundingBox()
  if (!box) {
    throw new Error('the probe page rendered no deny button')
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  if (strand) {
    // exactly what saveNote does when its write lands inside the press: a
    // repaint asked for while a pointer is down, held until the click is out
    await page.evaluate('updateCard("x")')
  }
  await page.mouse.up()

  let blankAt = -1
  for (let t = 25; t < 350; t += 25) {
    await new Promise(r => setTimeout(r, 25))
    if (blankAt < 0 && (await pressedIn(page)) !== 'deny') {
      blankAt = t
    }
  }
  check(
    `the press shows while the write is in flight (${strand ? 'with a repaint stranded by it' : 'nothing stranded'})`,
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
  await new Promise(r => setTimeout(r, 400))
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
  await new Promise(r => setTimeout(r, 400))
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
  await new Promise(r => setTimeout(r, 900))
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
  await new Promise(r => setTimeout(r, 700))
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

await browser.close()
if (failures.length) {
  console.log(`\n${failures.length} failing:\n  ${failures.join('\n  ')}`)
  process.exitCode = 1
} else {
  console.log('\nall review-client repaint properties hold')
}
