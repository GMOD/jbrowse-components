/* eslint-disable no-console */
// Where a display's canvas and the DOM overlays over it land on the device
// grid at a fractional dpr: the multi-sample variant display's row separators
// as HTML boxes, the same bands as SVG lines, and the cell edges beside them.
//
//     pnpm --filter @jbrowse/web build
//     node browser-tests/probe-overlay-device-origin.ts --browser=chrome --dpr=1.5 --out=/tmp/shots/origin
//     node browser-tests/probe-overlay-device-origin.ts --browser=firefox --dpr=1.5 --nudge=0.5 --out=...
//
// Prints the canvas's page top in device px, its ancestors, the device rows
// where the cells change color, and each overlay's ink per device row (a
// viewport screenshot with it, minus one without) against the strongest row.
// A crisp separator inks round(dpr) rows at about 1.00 from a cell edge down.
//
//  - `--nudge=<f>` moves the rendering container so the canvas starts that
//    fraction of a device px past a whole one; `--will-change=canvas|rows`
//    promotes one to its own layer.
//  - `--emulate-dpr` is the control: Chrome under puppeteer's
//    `deviceScaleFactor` emulation, which blurs the cells and smears both
//    overlays at a fractional dpr.
import { Buffer } from 'node:buffer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { BASE_CHROME_ARGS, chromeAtDpr } from '@jbrowse/browser-test-utils'
import { PNG } from 'pngjs'
import { launch } from 'puppeteer'

import {
  delay,
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'
import { snapshotConfig } from './snapshot.ts'

import type { Page } from 'puppeteer'

const FIREFOX = process.env.FIREFOX_NIGHTLY_PATH ?? '/usr/bin/firefox-nightly'
const arg = (name: string) => {
  const found = process.argv.find(a => a.startsWith(`--${name}=`))
  return found?.slice(name.length + 3)
}
const OUT = arg('out')
const DPR = Number(arg('dpr') ?? 1)
const BROWSER = (arg('browser') ?? 'chrome') as 'chrome' | 'firefox'
const BACKEND = arg('backend') ?? (BROWSER === 'firefox' ? 'webgpu' : 'webgl')

const NUDGE = arg('nudge')
const WILL_CHANGE = arg('will-change')
const EMULATE = process.argv.includes('--emulate-dpr')
const EXACT_WIDTH = process.argv.includes('--exact-width')
const TRACK = 'volvox multi-sample sv'
const SEL = `[data-display-id^="${TRACK}"]`

function readPng(buf: Uint8Array) {
  // @ts-expect-error pngjs accepts a Uint8Array at runtime
  return PNG.sync.read(buf)
}

async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise(r => {
        requestAnimationFrame(() => requestAnimationFrame(r))
      }),
  )
  await delay(1500)
}

async function geometry(page: Page) {
  return page.evaluate(sel => {
    const display = document.querySelector(sel)!
    const canvas = [...display.querySelectorAll('canvas')].sort(
      (a, b) => b.width * b.height - a.width * a.height,
    )[0]!
    const dpr = window.devicePixelRatio
    const chain: string[] = []
    for (
      let el: Element | null = canvas;
      el && el !== document.body;
      el = el.parentElement
    ) {
      const cs = getComputedStyle(el)
      const flags = [
        cs.transform !== 'none' ? `transform:${cs.transform}` : '',
        cs.willChange !== 'auto' ? `will-change:${cs.willChange}` : '',
        cs.contain !== 'none' ? `contain:${cs.contain}` : '',
        cs.overflow !== 'visible' ? `overflow:${cs.overflow}` : '',
        cs.position !== 'static' ? cs.position : '',
      ].filter(Boolean)
      const t = el.getBoundingClientRect().top
      const testid = (el as HTMLElement).dataset.testid
      chain.push(
        `${el.tagName.toLowerCase()}${testid ? `[${testid}]` : ''} top ${t.toFixed(3)} css = ${(t * dpr).toFixed(3)} dev ${flags.join(' ')}`,
      )
    }
    const c = canvas.getBoundingClientRect()
    return {
      dpr,
      canvasTopDev: c.top * dpr,
      canvasLeftDev: c.left * dpr,
      canvasWidthDev: c.width * dpr,
      backing: `${canvas.width}x${canvas.height}`,
      chain,
    }
  }, SEL)
}

async function setSeparators(page: Page, on: boolean) {
  await page.evaluate(v => {
    ;(
      window as any
    ).JBrowseSession.views[0].tracks[0].displays[0].setShowRowSeparators(v)
  }, on)
  await settle(page)
}

function inkRows(
  on: Uint8Array,
  off: Uint8Array,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
) {
  const a = readPng(on)
  const b = readPng(off)
  const rows: { y: number; d: number }[] = []
  for (let y = y0; y < Math.min(y1, a.height); y++) {
    let sum = 0
    for (let x = x0; x < x1; x++) {
      const i = (y * a.width + x) * 4
      sum +=
        Math.abs(a.data[i]! - b.data[i]!) +
        Math.abs(a.data[i + 1]! - b.data[i + 1]!) +
        Math.abs(a.data[i + 2]! - b.data[i + 2]!)
    }
    rows.push({ y, d: sum / (x1 - x0) })
  }
  const max = Math.max(...rows.map(r => r.d))
  const runs: string[] = []
  let cur: string[] = []
  for (const r of rows) {
    if (r.d > max * 0.05) {
      cur.push(`${r.y}(${(r.d / max).toFixed(2)})`)
    } else if (cur.length) {
      runs.push(cur.join(' '))
      cur = []
    }
  }
  return runs.slice(0, 3)
}

// Device rows where the cells change color in many columns: the cell grid as
// the screen shows it.
function cellEdges(
  off: Uint8Array,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
) {
  const p = readPng(off)
  const edges: number[] = []
  let partial = 0
  for (let y = y0 + 1; y < Math.min(y1, p.height - 1); y++) {
    let changed = 0
    let blended = 0
    for (let x = x0; x < x1; x++) {
      const px = (yy: number) => {
        const i = (yy * p.width + x) * 4
        return (p.data[i]! << 16) | (p.data[i + 1]! << 8) | p.data[i + 2]!
      }
      const u = px(y - 1)
      const c = px(y)
      const d = px(y + 1)
      if (c !== u) {
        changed++
      }
      if (u !== d && c !== u && c !== d) {
        blended++
      }
    }
    if (changed > (x1 - x0) * 0.3) {
      edges.push(y)
    }
    partial += blended
  }
  return { edges, partial }
}

function rowsDump(
  buf: Uint8Array,
  left: number,
  width: number,
  y0: number,
  n: number,
) {
  const p = readPng(buf)
  const lines: string[] = []
  for (let y = y0; y < y0 + n; y++) {
    const cells: string[] = []
    for (let k = 0; k < 12; k++) {
      const x = Math.round(left + 20 + ((width - 40) * k) / 11)
      const i = (y * p.width + x) * 4
      cells.push(
        ((p.data[i]! << 16) | (p.data[i + 1]! << 8) | p.data[i + 2]!)
          .toString(16)
          .padStart(6, '0'),
      )
    }
    lines.push(`  ${y} ${cells.join(' ')}`)
  }
  return lines.join('\n')
}

// The whole-device-px offset at which the screen best reproduces the backing
// store, and the share of backing px that differ there. Zero means the browser
// drew the canvas unresampled.
function backingMatch(
  backing: { w: number; h: number; data: Uint8Array },
  screen: Uint8Array,
  g: { canvasTopDev: number; canvasLeftDev: number },
) {
  const p = readPng(screen)
  let best = { dx: 0, dy: 0, differing: Infinity, total: 0 }
  for (const dy of [-1, 0, 1]) {
    for (const dx of [-1, 0, 1]) {
      const oy = Math.round(g.canvasTopDev) + dy
      const ox = Math.round(g.canvasLeftDev) + dx
      let differing = 0
      let total = 0
      // the middle columns, clear of the row labels drawn over the left
      for (let y = 0; y < Math.min(backing.h, p.height - oy); y++) {
        for (
          let x = Math.round(backing.w * 0.3);
          x < Math.round(backing.w * 0.7);
          x += 3
        ) {
          const b = (y * backing.w + x) * 4
          if (backing.data[b + 3] !== 255) {
            continue
          }
          const s = ((oy + y) * p.width + ox + x) * 4
          total++
          if (
            Math.abs(backing.data[b]! - p.data[s]!) > 2 ||
            Math.abs(backing.data[b + 1]! - p.data[s + 1]!) > 2 ||
            Math.abs(backing.data[b + 2]! - p.data[s + 2]!) > 2
          ) {
            differing++
          }
        }
      }
      if (differing < best.differing) {
        best = { dx: ox, dy: oy, differing, total }
      }
    }
  }
  const y = Math.round(backing.h / 3)
  const row = (get: (x: number) => number) =>
    Array.from({ length: 24 }, (_, i) =>
      get(Math.round(backing.w * 0.3) + i)
        .toString(16)
        .padStart(6, '0'),
    ).join(' ')
  const sample = `\n  backing row ${y}: ${row(x => {
    const b = (y * backing.w + x) * 4
    return (
      (backing.data[b]! << 16) |
      (backing.data[b + 1]! << 8) |
      backing.data[b + 2]!
    )
  })}\n  screen  row ${best.dy + y}: ${row(x => {
    const s = ((best.dy + y) * p.width + best.dx + x) * 4
    return (p.data[s]! << 16) | (p.data[s + 1]! << 8) | p.data[s + 2]!
  })}`
  return `best at device (${best.dx}, ${best.dy}), ${best.differing} of ${best.total} opaque backing px differ${sample}`
}

async function main() {
  if (!OUT) {
    throw new Error('pass --out=<dir>')
  }
  mkdirSync(OUT, { recursive: true })
  snapshotConfig.backend = BACKEND
  const { port, server } = await startServerOnFreePort(3591)
  setPort(port)
  const browser =
    BROWSER === 'firefox'
      ? await launch({
          browser: 'firefox',
          executablePath: FIREFOX,
          headless: false,
          timeout: 60000,
          extraPrefsFirefox: {
            'layout.css.devPixelsPerPx': DPR.toFixed(2),
            'dom.webgpu.enabled': true,
            'gfx.webrender.all': true,
            'gfx.webgpu.ignore-blocklist': true,
          },
          defaultViewport: { width: 1280, height: 700 },
        })
      : await launch({
          headless: true,
          args: [
            ...BASE_CHROME_ARGS,
            BACKEND === 'canvas2d' ? '--disable-gpu' : '--use-gl=angle',
            ...(EMULATE ? [] : chromeAtDpr(DPR, 1280, 700).args),
          ],
          defaultViewport: EMULATE
            ? { width: 1280, height: 700, deviceScaleFactor: DPR }
            : chromeAtDpr(DPR, 1280, 700).defaultViewport,
        })
  const page = await browser.newPage()
  try {
    await navigateWithSessionSpec(
      page,
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'volvox',
            loc: 'ctgA:1-50,000',
            tracks: [
              {
                trackId: TRACK,
                displaySnapshot: {
                  type: 'LinearMultiSampleVariantDisplay',
                  height: 360,
                },
              },
            ],
          },
        ],
      },
      'test_data/volvox/config.json',
    )
    await waitForDataLoaded(page, 120000)
    await page.waitForSelector(`${SEL}[data-display-drawn="true"]`, {
      timeout: 120000,
    })
    await page.mouse.move(1, 1)
    await setSeparators(page, true)
    if (NUDGE) {
      await page.evaluate(
        (sel, frac) => {
          const display = document.querySelector(sel)!
          const canvas = display.querySelector('canvas')!
          const container = display.closest(
            '[data-testid^="trackRenderingContainer"]',
          ) as HTMLElement
          const dpr = window.devicePixelRatio
          const top = canvas.getBoundingClientRect().top
          const target = (Math.floor(top * dpr) + 1 + frac) / dpr
          container.style.top = `${target - top}px`
        },
        SEL,
        Number(NUDGE),
      )
    }
    if (EXACT_WIDTH) {
      await page.evaluate(sel => {
        const canvas = document.querySelector(sel)!.querySelector('canvas')!
        canvas.style.width = `${canvas.width / window.devicePixelRatio}px`
        canvas.style.height = `${canvas.height / window.devicePixelRatio}px`
      }, SEL)
    }
    if (WILL_CHANGE) {
      await page.evaluate(
        (sel, target) => {
          const display = document.querySelector(sel)!
          const el = display.querySelector<HTMLElement>(
            target === 'canvas' ? 'canvas' : '[data-testid$="-rows"]',
          )!
          el.style.willChange = 'transform'
        },
        SEL,
        WILL_CHANGE,
      )
    }
    await delay(2000)
    const g = await geometry(page)
    const on = await page.screenshot({ type: 'png' })
    const elOn = await (await page.$(SEL))!.screenshot({ type: 'png' })
    const bands = await page.evaluate(sel => {
      const seps = document
        .querySelector(sel)!
        .querySelector('[data-testid="variant-row-separators"]')
      return [...(seps?.querySelectorAll('line') ?? [])].map(line => {
        const height = Number(line.getAttribute('stroke-width'))
        return { top: Number(line.getAttribute('y1')) - height / 2, height }
      })
    }, SEL)
    await setSeparators(page, false)
    const off = await page.screenshot({ type: 'png' })
    const elOff = await (await page.$(SEL))!.screenshot({ type: 'png' })
    // A Canvas2D backing read back directly: the screen holds it 1:1 at some
    // whole device offset unless the browser resampled the canvas.
    // A PNG, not an array: a few million numbers time out over WebDriver BiDi.
    const backingUrl = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-testid="variant_canvas"]',
      )!
      return canvas.getContext('2d') ? canvas.toDataURL('image/png') : undefined
    })
    const backingPng =
      backingUrl &&
      readPng(
        Buffer.from(backingUrl.slice(backingUrl.indexOf(',') + 1), 'base64'),
      )
    const backing = backingPng && {
      w: backingPng.width,
      h: backingPng.height,
      data: backingPng.data,
    }
    writeFileSync(join(OUT, 'element-on.png'), elOn)
    // The same bands as HTML boxes, the other shape an overlay takes.
    await page.evaluate(
      (sel, bands) => {
        const panel = document
          .querySelector(sel)!
          .querySelector('[data-testid$="-rows"]')!
        const layer = document.createElement('div')
        layer.id = 'probe-boxes'
        for (const b of bands) {
          const box = document.createElement('div')
          box.style.cssText = `position:absolute;left:0;width:5000px;top:${b.top}px;height:${b.height}px;background:rgba(0,0,0,0.4)`
          layer.append(box)
        }
        panel.append(layer)
      },
      SEL,
      bands,
    )
    await settle(page)
    const boxShot = await page.screenshot({ type: 'png' })
    writeFileSync(join(OUT, 'boxes.png'), boxShot)
    await page.evaluate(() => document.getElementById('probe-boxes')?.remove())
    writeFileSync(join(OUT, 'on.png'), on)
    writeFileSync(join(OUT, 'off.png'), off)
    const x0 = Math.ceil(g.canvasLeftDev + g.canvasWidthDev * 0.3)
    const x1 = Math.floor(g.canvasLeftDev + g.canvasWidthDev * 0.7)
    const y0 = Math.floor(g.canvasTopDev) - 2
    const y1 = y0 + 120
    const { edges, partial } = cellEdges(off, x0, x1, y0, y1)
    console.log(
      JSON.stringify(
        {
          browser: BROWSER,
          backend: BACKEND,
          dpr: g.dpr,
          backing: g.backing,
          canvasTopDev: +g.canvasTopDev.toFixed(3),
          canvasLeftDev: +g.canvasLeftDev.toFixed(3),
          canvasWidthDev: +g.canvasWidthDev.toFixed(3),
          firstSeparatorTopDev:
            bands[0] && +(g.canvasTopDev + bands[0].top * g.dpr).toFixed(3),
          screenshot: `${readPng(on).width}x${readPng(on).height}`,
        },
        null,
        1,
      ),
    )
    console.log(g.chain.join('\n'))
    console.log('cell edges (device rows):', edges.join(' '))
    console.log('cell blended px:', partial)
    if (backing && backingUrl) {
      writeFileSync(
        join(OUT, 'backing.png'),
        Buffer.from(backingUrl.slice(backingUrl.indexOf(',') + 1), 'base64'),
      )
      console.log('canvas2d backing vs screen:', backingMatch(backing, off, g))
    }
    const top = Math.floor(g.canvasTopDev)
    console.log('off, rows at the canvas top:')
    console.log(rowsDump(off, g.canvasLeftDev, g.canvasWidthDev, top - 2, 5))
    if (bands[0]) {
      const b = Math.floor(g.canvasTopDev + bands[0].top * g.dpr)
      console.log('off, rows at the first separator:')
      console.log(rowsDump(off, g.canvasLeftDev, g.canvasWidthDev, b - 2, 6))
      console.log('on, rows at the first separator:')
      console.log(rowsDump(on, g.canvasLeftDev, g.canvasWidthDev, b - 2, 6))
    }
    console.log('on-screen separator ink runs:')
    for (const r of inkRows(on, off, x0, x1, y0, y1)) {
      console.log('  ', r)
    }
    const elW = readPng(elOn).width
    console.log('element screenshot separator ink runs:')
    for (const r of inkRows(
      elOn,
      elOff,
      Math.round(elW * 0.3),
      Math.round(elW * 0.7),
      0,
      120,
    )) {
      console.log('  ', r)
    }
    console.log('html box ink runs:')
    for (const r of inkRows(boxShot, off, x0, x1, y0, y1)) {
      console.log('  ', r)
    }
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
