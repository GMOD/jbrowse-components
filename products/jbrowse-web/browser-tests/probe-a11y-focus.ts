// Drives the keyboard/announcement path against a real browser, which is the
// only place any of it can be observed: `:focus-visible` is a browser heuristic
// with no jsdom equivalent, so the one question that matters here — does a click
// draw a focus ring — cannot be asked in jest at all.
//
// Prints one line per check plus a shot before and after, so the mouse path can
// be compared pixel-for-pixel with the same run on `main`.
//
//     node browser-tests/probe-a11y-focus.ts
//     PORT=3123 OUT=/tmp/shots HEADLESS=0 node browser-tests/probe-a11y-focus.ts

import { tmpdir } from 'node:os'
import { join } from 'node:path'

import puppeteer from 'puppeteer'

const encodeSessionSpec = (o: object) =>
  encodeURIComponent(`spec-${JSON.stringify(o)}`)

const OUT = process.env.OUT || tmpdir()
const HEADLESS = process.env.HEADLESS !== '0'
const PORT = Number(process.env.PORT || 3000)

const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_alignments', 'volvox_filtered_vcf'],
    },
  ],
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  })
  const page = await browser.newPage()
  const url = `http://localhost:${PORT}/?config=test_data/volvox/config.json&session=${encodeSessionSpec(spec)}&sessionName=A11y`
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 })
  await page.waitForSelector('[data-testid^="view-container-"]', {
    timeout: 120000,
  })
  await delay(9000)

  const containerSel = '[data-testid^="view-container-"]'

  const attrs = await page.$eval(containerSel, el => ({
    tabIndex: el.getAttribute('tabindex'),
    role: el.getAttribute('role'),
    label: el.getAttribute('aria-label'),
  }))
  console.log('container attrs:', JSON.stringify(attrs))

  console.log(
    'focusedViewId at load (nothing should have claimed it):',
    await page.evaluate(() => (window as any).JBrowseSession?.focusedViewId),
  )

  // --- mouse path: a click must NOT draw a ring, NOR scroll the page --------
  const box = await (await page.$(
    '[data-testid="tracksContainer"]',
  ))!.boundingBox()
  const scrollBefore = await page.evaluate(() => {
    const el = document.scrollingElement!
    el.scrollTop = 120
    return el.scrollTop
  })
  await delay(200)
  await page.mouse.click(box!.x + box!.width / 2, box!.y + 40)
  await delay(500)
  const scrollAfter = await page.evaluate(
    () => document.scrollingElement!.scrollTop,
  )
  console.log(
    'page scrollTop across the click:',
    scrollBefore,
    '->',
    scrollAfter,
  )
  const afterClick = await page.$eval(containerSel, el => ({
    isActive: document.activeElement === el,
    focusVisible: el.matches(':focus-visible'),
    outline: getComputedStyle(el).outlineStyle,
    outlineWidth: getComputedStyle(el).outlineWidth,
  }))
  console.log('after click:', JSON.stringify(afterClick))
  await page.screenshot({ path: join(OUT, 'a11y-after-click.png') })

  const focusedAfterClick = await page.evaluate(
    () => (window as any).JBrowseSession?.focusedViewId,
  )
  console.log('focusedViewId after click:', focusedAfterClick)

  // --- keyboard path: Tab must land on the view and DRAW a ring -------------
  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    document.body.focus()
  })
  await page.evaluate(() => {
    ;(window as any).JBrowseSession?.setFocusedViewId?.('cleared')
  })

  let tabs = 0
  let landed = false
  for (; tabs < 40 && !landed; tabs++) {
    // eslint-disable-next-line no-await-in-loop
    await page.keyboard.press('Tab')
    // eslint-disable-next-line no-await-in-loop
    landed = await page.$eval(containerSel, el => document.activeElement === el)
  }
  const afterTab = await page.$eval(containerSel, el => ({
    isActive: document.activeElement === el,
    focusVisible: el.matches(':focus-visible'),
    outline: getComputedStyle(el).outlineStyle,
    outlineWidth: getComputedStyle(el).outlineWidth,
    outlineColor: getComputedStyle(el).outlineColor,
  }))
  console.log(`after ${tabs} tab(s):`, JSON.stringify(afterTab))
  await page.screenshot({ path: join(OUT, 'a11y-after-tab.png') })

  const focusedAfterTab = await page.evaluate(
    () => (window as any).JBrowseSession?.focusedViewId,
  )
  const viewId = await page.evaluate(
    () => (window as any).JBrowseSession?.views?.[0]?.id,
  )
  console.log('focusedViewId after tab:', focusedAfterTab, '(view', viewId, ')')

  // --- the shortcut the focus was for --------------------------------------
  const before = await page.evaluate(
    () => (window as any).JBrowseSession?.views?.[0]?.offsetPx,
  )
  await page.keyboard.down('Control')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.up('Control')
  await delay(500)
  const after = await page.evaluate(
    () => (window as any).JBrowseSession?.views?.[0]?.offsetPx,
  )
  console.log('ctrl+right moved offsetPx:', before, '->', after)

  // --- the live region ------------------------------------------------------
  await delay(1200)
  const live = await page.$$eval('[aria-live="polite"]', els =>
    els.map(e => ({
      text: e.textContent,
      atomic: e.getAttribute('aria-atomic'),
    })),
  )
  console.log('live regions:', JSON.stringify(live))

  // it must not restate per frame: count changes across a drag
  await page.evaluate(() => {
    const w = window as any
    w.__liveChanges = 0
    const el = document.querySelector('[aria-live="polite"]')!
    w.__liveObserver = new MutationObserver(() => w.__liveChanges++)
    w.__liveObserver.observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    })
  })
  // the frames run INSIDE the page, on rAF: one page.evaluate per frame costs a
  // CDP round trip each and stretches a 25-frame drag past a second, which
  // crosses the 500ms debounce and measures the debounce rather than the region
  const dragMs = await page.evaluate(async () => {
    const view = (window as any).JBrowseSession?.views?.[0]
    const t0 = performance.now()
    for (let i = 0; i < 25; i++) {
      view?.horizontalScroll(7)
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => requestAnimationFrame(r))
    }
    return performance.now() - t0
  })
  const duringDrag = await page.evaluate(() => (window as any).__liveChanges)
  await delay(1200)
  const afterSettle = await page.evaluate(() => (window as any).__liveChanges)
  console.log(
    `live region text changes — during a 25-frame drag (${Math.round(dragMs)}ms):`,
    duringDrag,
    ', after settle:',
    afterSettle,
  )

  // --- track names ----------------------------------------------------------
  const figures = await page.$$eval('[role="figure"]', els =>
    els.map(e => e.getAttribute('aria-label')),
  )
  console.log('track display names:', JSON.stringify(figures))

  // --- the other half of the mouse path: click-drag still pans --------------
  const panBefore = await page.evaluate(
    () => (window as any).JBrowseSession?.views?.[0]?.offsetPx,
  )
  await page.mouse.move(box!.x + 600, box!.y + 60)
  await page.mouse.down()
  for (let i = 0; i < 10; i++) {
    // eslint-disable-next-line no-await-in-loop
    await page.mouse.move(box!.x + 600 - i * 20, box!.y + 60)
  }
  await page.mouse.up()
  await delay(500)
  const panAfter = await page.evaluate(
    () => (window as any).JBrowseSession?.views?.[0]?.offsetPx,
  )
  console.log('drag-to-pan moved offsetPx:', panBefore, '->', panAfter)

  // --- a stack of views, which is where "one tab stop per view" is testable
  // and where a focus-driven scroll would actually be visible ----------------
  const stack = {
    views: ['ctgA:1-20000', 'ctgA:20000-40000', 'ctgA:1-1000'].map(loc => ({
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc,
      tracks: ['volvox_filtered_vcf'],
    })),
  }
  await page.goto(
    `http://localhost:${PORT}/?config=test_data/volvox/config.json&session=${encodeSessionSpec(stack)}&sessionName=A11yStack`,
    { waitUntil: 'networkidle2', timeout: 120000 },
  )
  await page.waitForSelector(containerSel, { timeout: 120000 })
  await delay(9000)

  console.log(
    'view names:',
    JSON.stringify(
      await page.$$eval(containerSel, els =>
        els.map(e => e.getAttribute('aria-label')),
      ),
    ),
  )

  // the views scroll inside a container, not the document, so walk up for the
  // port rather than assuming document.scrollingElement
  const scrolled = await page.evaluate(() => {
    const w = window as unknown as { __port?: Element }
    const start = document.querySelector('[data-testid^="view-container-"]')
    let port: Element = document.scrollingElement!
    for (let n = start?.parentElement; n; n = n.parentElement) {
      if (n.scrollHeight > n.clientHeight + 8) {
        port = n
        break
      }
    }
    w.__port = port
    port.scrollTop = port.scrollHeight
    return { top: port.scrollTop, height: port.scrollHeight, tag: port.tagName }
  })
  await delay(400)
  const last = (await page.$$(containerSel)).at(-1)!
  const lastBox = (await last.boundingBox())!
  await page.mouse.click(lastBox.x + lastBox.width / 2, lastBox.y + 20)
  await delay(400)
  console.log(
    'scroll port',
    scrolled.tag,
    'scrollTop across a click in the bottom view:',
    scrolled.top,
    '->',
    await page.evaluate(
      () => (window as unknown as { __port?: Element }).__port?.scrollTop,
    ),
    '(scrollHeight',
    scrolled.height,
    ')',
  )
  console.log(
    'focused view is the one clicked:',
    await page.evaluate(() => {
      const s = (window as any).JBrowseSession
      return s?.focusedViewId === s?.views?.at(-1)?.id
    }),
  )

  // Tab from the first container: how many stops before the second view
  await page.$$eval(containerSel, els => {
    ;(els[0] as HTMLElement).focus()
  })
  let stops = 0
  let atSecond = false
  for (; stops < 60 && !atSecond; stops++) {
    // eslint-disable-next-line no-await-in-loop
    await page.keyboard.press('Tab')
    // eslint-disable-next-line no-await-in-loop
    atSecond = await page.$$eval(
      containerSel,
      els => document.activeElement === els[1],
    )
  }
  console.log(
    'tab stops between view 1 and view 2:',
    atSecond ? stops : 'not reached',
  )
  console.log(
    'focusedViewId follows the tab:',
    await page.evaluate(() => {
      const s = (window as any).JBrowseSession
      return s?.focusedViewId === s?.views?.[1]?.id
    }),
  )

  // --- and the shortcuts are findable: Help > Help --------------------------
  await page.evaluate(() => {
    const s = (window as any).JBrowseSession
    s.showWidget(s.addWidget('HelpWidget', 'helpWidget'))
  })
  await page.waitForFunction(
    () => document.body.textContent.includes('Keyboard shortcuts'),
    { timeout: 20000 },
  )
  console.log(
    'help widget lists:',
    JSON.stringify(
      await page.evaluate(() =>
        [...document.querySelectorAll('td')]
          .map(td => td.textContent)
          .filter(t => t.includes('Ctrl')),
      ),
    ),
  )
  await page.screenshot({ path: join(OUT, 'a11y-help-widget.png') })

  await browser.close()
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
