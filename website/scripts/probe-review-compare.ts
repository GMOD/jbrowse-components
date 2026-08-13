#!/usr/bin/env node
/**
 * probe-review-compare.ts — is the way the page is comparing the page's, and
 * does a card that was off screen when it changed agree once you reach it?
 *
 *   node scripts/review-screenshots-web.ts &     # the page under test
 *   node scripts/probe-review-compare.ts [--port=3335] [--q=alignments]
 *
 * Every control on a card's compare bar sets the whole page: the mode, the fade,
 * blink and amplify. What makes that worth a probe is the half that pays for it.
 * A drag is sixty changes a second across every card on the list, so the fade is
 * written straight to the elements rather than rendered, and only to the ones on
 * screen — the rest are caught up by an IntersectionObserver as they come into
 * view. When that catch-up breaks there is nothing to see: no error, no warning,
 * just a figure some way down the list drawn at a fade the page left behind, and
 * a reviewer reading it as the picture rather than as the tool.
 *
 * So the last two cases scroll somewhere the drag never touched and read the
 * pixels back. The first three are the plain claim — one bar, every card.
 *
 * Read-only: no verdict is ever filed, so it cannot touch
 * screenshot-review.json.
 */
import { parseArgs } from 'node:util'

import { launch } from 'puppeteer'

import type { Page } from 'puppeteer'

const { values } = parseArgs({
  options: { port: { type: 'string' }, q: { type: 'string' } },
})
const port = values.port ?? '3335'
const q = values.q ?? ''

const failures: string[] = []

function check(name: string, ok: boolean, detail: string) {
  if (!ok) {
    failures.push(name)
  }
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
  console.log(`       ${detail}`)
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

// What every stage on the page is drawing, and what every readout in the bars
// says, split by whether the element is somewhere the reviewer could see it.
// The two are deliberately kept apart: off screen disagreeing is the design,
// on screen disagreeing is the bug.
function readPage(page: Page) {
  return page.evaluate(() => {
    const seen = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.bottom > 0 && r.top < innerHeight
    }
    const stages = [...document.querySelectorAll('.cmpstage')]
    const fade = (el: Element) =>
      getComputedStyle(el).getPropertyValue('--fade').trim()
    return {
      cards: document.querySelectorAll('.card').length,
      bars: document.querySelectorAll('.cmpbar').length,
      stages: stages.length,
      modes: [
        ...new Set(
          stages.map(s =>
            [...s.classList].filter(c => c !== 'cmpstage').join(','),
          ),
        ),
      ],
      // the segmented control's own idea of the mode, and the header's
      lit: [
        ...new Set(
          [...document.querySelectorAll('.cmpmodes')].map(
            m => m.querySelector('.cmpbtn.on')?.textContent ?? 'none',
          ),
        ),
      ],
      header: document.querySelector<HTMLSelectElement>(
        'header select[title^="How each card"]',
      )?.value,
      search: location.search,
      fadeSeen: [...new Set(stages.filter(seen).map(fade))],
      fadeUnseen: [...new Set(stages.filter(s => !seen(s)).map(fade))],
      readouts: [
        ...new Set(
          [...document.querySelectorAll('.cmppct')]
            .filter(seen)
            .map(e => e.textContent),
        ),
      ],
      sliders: [
        ...new Set(
          [...document.querySelectorAll<HTMLInputElement>('.cmpslider')]
            .filter(seen)
            .map(e => e.value),
        ),
      ],
      // what the pixels do, rather than what the variable says
      painting: [
        ...new Set(
          stages.filter(seen).map(s => {
            const top = getComputedStyle(s.querySelector('.cmptop')!)
            return [top.opacity, top.animationName, top.clipPath].join(' ')
          }),
        ),
      ],
    }
  })
}

// The bar of the nth card that HAS one — a figure with no baseline gets no
// compare bar, and those are scattered through the list rather than at the end.
async function bar(page: Page, nth: number) {
  const bars = await page.$$('.cmpbar')
  const el = bars[nth]
  if (!el) {
    throw new Error(`the page drew ${bars.length} compare bars, wanted ${nth}`)
  }
  return el
}

async function press(page: Page, nth: number, label: string) {
  const buttons = await (await bar(page, nth)).$$('.cmpbtn')
  for (const b of buttons) {
    const text = await b.evaluate(e => e.textContent)
    if (text.includes(label)) {
      await b.click()
      await wait(250)
      return
    }
  }
  throw new Error(`no "${label}" button on compare bar ${nth}`)
}

const browser = await launch({ args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 900 })
await page.goto(`http://localhost:${port}/?status=all&compare=side&q=${q}`, {
  waitUntil: 'domcontentloaded',
})
// Either the list, or the page saying it has none — so a filter that selects
// nothing is answered by the guard below, with what to do about it, rather than
// by a 30s wait for a card that is never coming and a stack from inside
// puppeteer. The empty state has to be read rather than merely found: it carries
// the LOADING message too, and that one is true a beat before the specs land.
await page.waitForFunction(() => {
  const empty = document.querySelector('.empty')
  return (
    !!document.querySelector('.card') ||
    (!!empty && !empty.textContent.includes('Loading'))
  )
})

// A pass over nothing reads exactly like a pass, which is the one result this
// must not be able to give. Every case below needs a card to change and another,
// far away, to check it against.
const start = await readPage(page)
if (start.bars < 3) {
  console.log(
    `only ${start.bars} of ${start.cards} cards can be compared — nothing to probe.\n` +
      'Run pnpm figures:pull, or drop --q.',
  )
  await browser.close()
  process.exit(1)
}
console.log(`${start.cards} cards, ${start.bars} of them with a compare bar\n`)

// ---------------------------------------------------------------------------
// 1. the mode on one card's bar is the mode of the page
// ---------------------------------------------------------------------------
await press(page, 2, 'onion')
{
  const p = await readPage(page)
  check(
    'onion pressed on one card puts every card in onion',
    p.modes.length === 1 && p.modes[0] === 'onion' && p.stages === p.bars,
    `${p.stages} stages drawing ${JSON.stringify(p.modes)}; ${p.bars} bars lit ${JSON.stringify(p.lit)}`,
  )
  check(
    'the header control and the URL follow the card that was pressed',
    p.header === 'onion' && p.search.includes('compare=onion'),
    `header select: ${p.header}; url: ${p.search}`,
  )
}

// ---------------------------------------------------------------------------
// 2. so is the fade, for everything on screen
// ---------------------------------------------------------------------------
const slider = await (await bar(page, 2)).$('.cmpslider')
if (!slider) {
  // fatal rather than a failure: the page is not in onion, so every case below
  // would be measuring the wrong thing
  throw new Error('the bar pressed into onion drew no slider — stopping here')
}
// From the keyboard, because it is exact: a range input steps by one per press,
// so the value under test is known rather than measured off a drag.
await slider.focus()
for (let i = 0; i < 12; i++) {
  await page.keyboard.press('ArrowLeft')
}
await wait(250)
{
  const p = await readPage(page)
  check(
    'the fade moved on one bar moves every stage on screen',
    p.fadeSeen.length === 1 && p.fadeSeen[0] === '0.38',
    `--fade on screen: ${JSON.stringify(p.fadeSeen)}; painting: ${JSON.stringify(p.painting)}`,
  )
  check(
    'every readout and slider on screen says the same thing',
    p.readouts.length === 1 &&
      p.readouts[0] === '38%' &&
      p.sliders.length === 1 &&
      p.sliders[0] === '38',
    `readouts: ${JSON.stringify(p.readouts)}; slider values: ${JSON.stringify(p.sliders)}`,
  )
}

// ---------------------------------------------------------------------------
// 3. …and a card that was nowhere near the screen when it moved
// ---------------------------------------------------------------------------
// the last STAGE, not the last card: a figure with no baseline draws two columns
// and no stage, and landing on one of those would check nothing while passing
await page.evaluate(() => {
  ;[...document.querySelectorAll('.cmpstage')].at(-1)?.scrollIntoView()
})
// an intersection callback is delivered with the frame, not with the scroll
await wait(400)
{
  const p = await readPage(page)
  check(
    'a card scrolled to after the fade moved is drawn at the page fade',
    p.fadeSeen.length === 1 && p.fadeSeen[0] === '0.38',
    `--fade at the bottom of the list: ${JSON.stringify(p.fadeSeen)}; painting: ${JSON.stringify(p.painting)}`,
  )
}

// ---------------------------------------------------------------------------
// 4. blink is the page's too, and it is a class rather than a re-render — so
//    the card it is turned on from is the one place it could plausibly stop
// ---------------------------------------------------------------------------
const barsNow = await page.$$('.cmpbar')
await press(page, barsNow.length - 1, 'blink')
{
  const p = await readPage(page)
  check(
    'blink turned on from one bar animates every stage on screen',
    p.painting.length > 0 && p.painting.every(s => s.includes('cmpblink')),
    `painting: ${JSON.stringify(p.painting)}`,
  )
}

// ---------------------------------------------------------------------------
// 5. the divider dragged on the picture itself is the same page-wide value, and
//    it is the one path that does not go through the bar at all
// ---------------------------------------------------------------------------
await press(page, barsNow.length - 1, 'swipe')
{
  // back to the top, so the picture being dragged is one the pointer can reach:
  // an off-screen element's box is off-screen coordinates
  await page.evaluate(() => {
    scrollTo(0, 0)
  })
  await wait(400)
  const stage = await page.$('.cmpstage')
  const box = await stage?.boundingBox()
  if (!box) {
    throw new Error('no stage to drag')
  }
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2, {
    steps: 8,
  })
  await page.mouse.up()
  await wait(250)
  const p = await readPage(page)
  check(
    'dragging the divider on one picture moves it on every card on screen',
    p.readouts.length === 1 &&
      p.readouts[0] === '75%' &&
      p.fadeSeen.length === 1 &&
      p.fadeSeen[0] === '0.75',
    `readouts: ${JSON.stringify(p.readouts)}; --fade: ${JSON.stringify(p.fadeSeen)}`,
  )
}

await browser.close()
if (failures.length) {
  console.log(`\n${failures.length} failing:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('\nthe compare view is the page’s, everywhere it is looked at')
