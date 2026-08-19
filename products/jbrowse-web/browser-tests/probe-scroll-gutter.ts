// With scroll-to-zoom on, the wheel is the view's — so what is left to scroll
// the page with? Nothing modal: browsers turn shift+wheel into horizontal
// scroll, ctrl/meta+wheel is how a trackpad reports a pinch, and Firefox binds
// alt+wheel to history navigation. What is left is spatial, and this measures
// it: the band of always-visible chrome above the tracks, where the wheel is
// nobody's and still scrolls the page.
//
// Prints the claimed/free map of the viewport, then wheels at a few heights and
// reports what moved. A run against a build that binds the wheel to the whole
// view shows the gutter collapsed to the view title bar alone.
//
// Run against a dev server or a built preview.
//
//     node browser-tests/probe-scroll-gutter.ts
//     PORT=3001 node browser-tests/probe-scroll-gutter.ts

import puppeteer from 'puppeteer'

const PORT = Number(process.env.PORT || 3000)
const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_alignments', 'volvox_maf', 'volvox_filtered_vcf'],
    },
  ],
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS !== '0',
    args: ['--no-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  })
  const page = await browser.newPage()
  const url = `http://localhost:${PORT}/?config=test_data/volvox/config.json&session=${encodeURIComponent(`spec-${JSON.stringify(spec)}`)}&sessionName=Gutter`
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 })
  await page.waitForSelector('button[value="scrollZoom"]', { timeout: 90000 })
  await delay(12000)

  // turn scroll-to-zoom on through its own control, and hold on to the element
  // that actually scrolls (an app-level div — the document itself does not)
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('button[value="scrollZoom"]')!.click()
    ;(window as any).scroller = (() => {
      const el = document.querySelector('[data-testid="tracksContainer"]')
      for (let n = el?.parentElement; n; n = n.parentElement) {
        if (
          n.scrollHeight > n.clientHeight &&
          /auto|scroll/.test(getComputedStyle(n).overflowY)
        ) {
          return n
        }
      }
      return document.scrollingElement
    })()
  })
  await delay(500)

  const read = () =>
    page.evaluate(() => {
      const s = (window as any).scroller as HTMLElement
      return {
        top: Math.round(s.scrollTop),
        max: Math.round(s.scrollHeight - s.clientHeight),
        loc: document.querySelector<HTMLInputElement>(
          'input[placeholder="Search for location"]',
        )?.value,
      }
    })

  const geom = await page.evaluate(() => {
    const tracks = document
      .querySelector('[data-testid="tracksContainer"]')!
      .getBoundingClientRect()
    return { tracksTop: Math.round(tracks.y) }
  })
  console.log(`tracks start at y=${geom.tracksTop}`)

  for (const y of [62, 100, 130, geom.tracksTop + 40]) {
    await page.evaluate(() => {
      ;((window as any).scroller as HTMLElement).scrollTop = 0
    })
    await page.mouse.move(700, y)
    await delay(250)
    const before = await read()
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel({ deltaY: 120 })
      await delay(120)
    }
    await delay(600)
    const after = await read()
    console.log(
      `wheel at y=${String(y).padStart(3)}  scroll ${before.top}->${after.top}/${after.max}  ${before.loc} -> ${after.loc}`,
    )
  }

  await browser.close()
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
