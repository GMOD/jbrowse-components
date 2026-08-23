/* eslint-disable no-console */
// One-off probe (not a suite): what the theme's ripple-duration override buys.
// It traces the click ripple's scale once per animation frame at MUI's default
// and at ours, which is the only way to see that 50ms is not a faster ripple —
// it is one or two frames, so the circle never visibly expands and the override
// really means "an instant press tint, no gesture".
//
// Also the check for the bug that scoping it fixed: a *focus* ripple is a
// different animation on the same elements (childPulsate, `infinite`), so a
// blanket duration strobes it forever. Neither fact is observable in jsdom —
// there are no animation frames and no `:focus-visible` — so it lives here.
//
//     node browser-tests/probe-ripple-duration.ts
import puppeteer from 'puppeteer'

import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const encodeSessionSpec = (o: object) =>
  encodeURIComponent(`spec-${JSON.stringify(o)}`)

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
const BUTTON = 'button[value="scrollZoom"]'

const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_filtered_vcf'],
    },
  ],
}

/**
 * Forces both halves of the click ripple to one duration so the same build can
 * be traced at either. Three classes, because it has to outrank TouchRipple's
 * own (0,2,0) rules — and, if the bundle predates the scoped override, that
 * override's (0,2,0) `!important` too.
 */
async function forceDuration(page: Page, ms: number) {
  await page.evaluate(duration => {
    document.getElementById('ripple-probe-style')?.remove()
    const style = document.createElement('style')
    style.id = 'ripple-probe-style'
    style.textContent = `
      .MuiButtonBase-root .MuiTouchRipple-root .MuiTouchRipple-ripple,
      .MuiButtonBase-root .MuiTouchRipple-root .MuiTouchRipple-child {
        animation-duration: ${duration}ms !important;
      }`
    document.head.append(style)
  }, ms)
}

async function trace(page: Page, ms: number) {
  await forceDuration(page, ms)
  const box = (await (await page.$(BUTTON))!.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await delay(400)
  await page.mouse.down()
  // Sampled in the page, one reading per frame: a round-trip per sample costs
  // more than the animation being measured.
  const readings = await page.evaluate(
    sel =>
      new Promise<string[]>(resolve => {
        const out: string[] = []
        const t0 = performance.now()
        const tick = () => {
          const ripple = document
            .querySelector(sel)
            ?.querySelector('.MuiTouchRipple-ripple')
          if (ripple) {
            const cs = getComputedStyle(ripple)
            const scale = /matrix\(([\d.]+)/.exec(cs.transform)
            out.push(
              `${String(Math.round(performance.now() - t0)).padStart(4)}ms  scale=${
                scale ? Number(scale[1]).toFixed(3) : cs.transform
              }  opacity=${Number(cs.opacity).toFixed(3)}  duration=${cs.animationDuration}`,
            )
          }
          if (performance.now() - t0 < 620) {
            requestAnimationFrame(tick)
          } else {
            resolve(out)
          }
        }
        requestAnimationFrame(tick)
      }),
    BUTTON,
  )
  await page.mouse.up()
  console.log(`\n--- click ripple at ${ms}ms ---`)
  console.log(readings.filter((_, i) => i % 3 === 0).join('\n'))
  await delay(900)
}

const { server, port } = await startServerOnFreePort(3000)
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--window-size=1400,900'],
  defaultViewport: { width: 1400, height: 900 },
})
try {
  const page = await browser.newPage()
  await page.goto(
    `http://localhost:${port}/?config=test_data/volvox/config.json&session=${encodeSessionSpec(spec)}&sessionName=Ripple`,
    { waitUntil: 'networkidle2', timeout: 120000 },
  )
  await page.waitForSelector(BUTTON, { timeout: 120000 })
  await delay(4000)
  await trace(page, 550)
  await trace(page, 50)
} finally {
  await browser.close()
  server.close()
}
