// What the linear genome view's header bar costs, piece by piece, and the
// window width at which the row stops holding it. The search box is the one
// control in that row with no equivalent anywhere else in the view, so it is
// the piece that has to survive a narrow window — this measures what the
// others are spending so the shedding order can be set against real pixels
// rather than against MUI's documented defaults.
//
// Starts its own server against the build:
//
//     node browser-tests/probe-lgv-header-fit.ts

import puppeteer from 'puppeteer'

import { startServerOnFreePort } from './server.ts'

const { server, port } = await startServerOnFreePort(3000)
const WIDTHS = [900, 800, 700, 600, 500, 450, 420, 390, 360, 320]

const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_alignments'],
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
  const url = `http://localhost:${port}/?config=test_data/volvox/config.json&session=${encodeURIComponent(`spec-${JSON.stringify(spec)}`)}&sessionName=HeaderFit`
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 })
  await page.waitForSelector('button[value="track_select"]', { timeout: 90000 })
  await delay(6000)

  const read = () =>
    page.evaluate(() => {
      const anchor = document.querySelector<HTMLElement>(
        'button[value="track_select"]',
      )!
      const bar = anchor.parentElement!
      const label = (el: Element) => {
        const e = el as HTMLElement
        const btn = e.matches('button') ? e : e.querySelector('button')
        return (
          btn?.getAttribute('value') ??
          e.querySelector<HTMLElement>('[data-testid]')?.dataset.testid ??
          e.dataset.testid ??
          (e.textContent.trim().slice(0, 18) || `<${e.tagName.toLowerCase()}>`)
        )
      }
      const box = (el: Element) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        return {
          w: Math.round(r.width),
          ml: Math.round(Number.parseFloat(cs.marginLeft)),
          mr: Math.round(Number.parseFloat(cs.marginRight)),
        }
      }
      const search = document.querySelector<HTMLElement>(
        '[data-testid="autocomplete"]',
      )
      // What the box spends on everything that is not the locstring, measured
      // rather than added up from MUI's defaults: the width the reserve
      // constants are supposed to name is exactly this minus the text.
      const chrome = (() => {
        if (!search) {
          return null
        }
        const input = search.querySelector('input')!
        const cs = getComputedStyle(input)
        const px = (v: string) => Number.parseFloat(v) || 0
        const text =
          input.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight)
        const adornment = search.querySelector('.MuiInputAdornment-root')
        const overflow = adornment?.querySelector('button')
        const icon = adornment?.querySelector('svg')
        const w = search.getBoundingClientRect().width
        // `measureText`'s Helvetica table stands in for the font the box
        // actually renders in, and the reserve is only safe to tighten if the
        // table is not under-measuring it
        const ctx = document.createElement('canvas').getContext('2d')!
        ctx.font = cs.font
        return {
          asked: search.style.width,
          value: input.value,
          font: cs.font,
          rendered: Math.round(ctx.measureText(input.value).width * 100) / 100,
          text: Math.round(text),
          chrome: Math.round(w - text),
          adornment: adornment
            ? Math.round(adornment.getBoundingClientRect().width)
            : null,
          overflow: overflow
            ? Math.round(overflow.getBoundingClientRect().width)
            : null,
          icon: icon ? Math.round(icon.getBoundingClientRect().width) : null,
        }
      })()
      return {
        bar: {
          client: bar.clientWidth,
          scroll: bar.scrollWidth,
        },
        search: search ? box(search).w : null,
        chrome,
        children: [...bar.children].map(c => ({ label: label(c), ...box(c) })),
      }
    })

  for (const width of WIDTHS) {
    await page.setViewport({ width, height: 900 })
    await delay(1200)
    const r = await read()
    const over = r.bar.scroll - r.bar.client
    console.log(
      `\nwindow ${width}  bar client ${r.bar.client}  scroll ${r.bar.scroll}` +
        `${over > 0 ? `  OVERFLOW +${over}` : ''}  search ${r.search}`,
    )
    console.log(
      r.children
        .map(c => `  ${c.label.padEnd(22)} ${c.w}  (m ${c.ml}/${c.mr})`)
        .join('\n'),
    )
    const c = r.chrome
    if (c) {
      console.log(
        `  search box: asked ${c.asked || '(none)'}  value "${c.value}"` +
          `  rendered ${c.rendered} in ${c.font}` +
          `  text ${c.text}  chrome ${c.chrome}` +
          `  (adornment ${c.adornment}, icon ${c.icon}, overflow ${c.overflow})`,
      )
    }
  }

  await browser.close()
  server.close()
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
