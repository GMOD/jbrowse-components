/* eslint-disable no-console */
import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseArgs } from 'util'

import {
  BASE_CHROME_ARGS,
  createTestServer,
  findChromeExecutable,
  isBrowserConsoleNoise,
  waitForDisplaysDone,
  waitForLoadingComplete,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { specs } from './screenshot-specs.ts'

import type {
  Annotation,
  ScreenshotAction,
  ScreenshotSpec,
} from './screenshot-specs.ts'
import type { Server } from 'http'
import type { Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Strict parsing rejects unknown flags (a typo'd `--fliter` fails loudly
// instead of silently screenshotting every spec) and accepts `--x=y` or `--x y`.
const { values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: false,
  options: {
    headed: { type: 'boolean', default: false },
    filter: { type: 'string' },
    exact: { type: 'boolean', default: false },
    // point the proxy at an already-running app server instead of build/
    port: { type: 'string' },
    localport: { type: 'string' },
    concurrency: { type: 'string' },
    // overwrite every PNG, bypassing the content-stable diff gate
    force: { type: 'boolean', default: false },
    // fraction-of-pixels diff below which a re-render keeps the committed PNG
    'diff-threshold': { type: 'string' },
  },
})

const { headed, filter, exact, force } = values
// Rendering is deterministic (an unchanged spec re-renders byte-for-byte), so a
// tight default keeps identical images stable while still letting genuine small
// edits — a legend, an annotation box — through. Raise it to absorb jitter on
// timing/remote-data specs.
const DEFAULT_DIFF_THRESHOLD = 0.001
const diffThreshold = values['diff-threshold']
  ? Number(values['diff-threshold'])
  : DEFAULT_DIFF_THRESHOLD
const externalPortVal = values.port ? Number(values.port) : Number.NaN
const externalPort = Number.isFinite(externalPortVal)
  ? externalPortVal
  : undefined
const localPortVal = values.localport ? Number(values.localport) : Number.NaN
const DEFAULT_PORT = Number.isFinite(localPortVal) ? localPortVal : 3334
const CONCURRENCY = values.concurrency
  ? Number(values.concurrency)
  : headed
    ? 1
    : 4

const repoRoot = path.resolve(__dirname, '..', '..')
const buildPath = path.resolve(repoRoot, 'products', 'jbrowse-web', 'build')
const testDataRoot = path.resolve(repoRoot, 'products', 'jbrowse-web')
const outDir = path.resolve(__dirname, '..', 'static', 'img')
const VOLVOX_CONFIG = 'test_data/volvox/config.json'
// Maximum time to wait for canvas displays to signal paint-complete via their
// *-done testids. Acts as a timeout (proceed if it expires), not a fixed floor.
const DEFAULT_SETTLE_MS = 2500

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Guard against capturing a view that rendered no content. The ViewContainer
// always renders its header chrome, so a screenshot with header-but-empty-body
// (e.g. a render regression) still "succeeds" and slips through review. A
// healthy view — including an import form — fills its body, so an empty body
// uniquely signals a broken render.
async function assertViewsRendered(page: Page, name: string) {
  const emptyViews = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="view-container-"]'))
      .filter(c => {
        const body = c.lastElementChild
        return !body || body.childElementCount === 0
      })
      .map(c => c.getAttribute('data-testid') ?? '?'),
  )
  if (emptyViews.length > 0) {
    await debugDump(page, name)
    throw new Error(`view(s) rendered blank: ${emptyViews.join(', ')}`)
  }
}

// Resolve an action's target element from either a CSS selector or visible
// text. Text matching (::-p-text) is how HTML floating labels / menu items are
// reached; selectors handle testid'd buttons.
async function resolveTarget(page: Page, action: ScreenshotAction) {
  if (action.selector) {
    return page.waitForSelector(action.selector, {
      visible: true,
      timeout: 30000,
    })
  }
  if (action.text) {
    return page.waitForSelector(`::-p-text(${action.text})`, {
      visible: true,
      timeout: 30000,
    })
  }
  return null
}

// Click a resolved element. A real mouse click at the element's center is
// preferred (it exercises hover/focus the way a user would), but absolutely-
// positioned overlays — e.g. an offset/overlapping track-name label sitting on
// top of a feature's floating label — can intercept that coordinate. When the
// element is covered (elementFromPoint resolves to a non-descendant), fall back
// to dispatching the click directly on the node, which still fires React's
// onClick but can't be stolen by a painted-over sibling.
async function clickElement(el: Awaited<ReturnType<typeof resolveTarget>>) {
  if (!el) {
    return
  }
  const covered = await el.evaluate(node => {
    const r = node.getBoundingClientRect()
    const top = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    )
    return !top || (top !== node && !node.contains(top) && !top.contains(node))
  })
  if (covered) {
    await el.evaluate(node => {
      ;(node as HTMLElement).click()
    })
  } else {
    await el.click()
  }
}

async function runAction(page: Page, action: ScreenshotAction) {
  if (action.type === 'delay') {
    await delay(action.ms ?? 500)
  } else if (action.type === 'click') {
    // canvas-drawn features (reads, gene glyphs) have no DOM node, so allow a
    // viewport-coordinate click via action.from
    if (action.from) {
      await page.mouse.click(action.from.x, action.from.y)
    } else {
      const el = await resolveTarget(page, action)
      await clickElement(el)
    }
  } else if (action.type === 'rightclick') {
    if (action.from) {
      await page.mouse.click(action.from.x, action.from.y, { button: 'right' })
    } else {
      const el = await resolveTarget(page, action)
      await el?.click({ button: 'right' })
    }
  } else if (action.type === 'hover') {
    // a bare coordinate move (e.g. off a read to dismiss its hover tooltip while
    // a just-opened context menu stays put)
    if (action.from) {
      await page.mouse.move(action.from.x, action.from.y)
    } else {
      const el = await resolveTarget(page, action)
      await el?.hover()
    }
  } else if (action.type === 'type') {
    const el = await resolveTarget(page, action)
    if (action.clear) {
      // triple-click selects the field's current text, then Backspace deletes it
      // so an empty value genuinely clears the field (typing '' alone leaves the
      // selection in place)
      await el?.click({ count: 3 })
      await page.keyboard.press('Backspace')
    } else {
      await el?.click()
    }
    await page.keyboard.type(action.value ?? '')
  } else if (action.type === 'drag' && action.from && action.to) {
    await page.mouse.move(action.from.x, action.from.y)
    await page.mouse.down()
    await page.mouse.move(action.to.x, action.to.y, { steps: 20 })
    await page.mouse.up()
  } else if (action.type === 'waitForSelector' && action.selector) {
    await page.waitForSelector(action.selector, {
      [action.hidden ? 'hidden' : 'visible']: true,
      timeout: 30000,
    })
  } else if (action.type === 'waitForText' && action.text) {
    await page.waitForSelector(`::-p-text(${action.text})`, {
      [action.hidden ? 'hidden' : 'visible']: true,
      timeout: 30000,
    })
  }
}

async function setLocation(page: Page, loc: string) {
  const locBox = await page.waitForSelector(
    'input[placeholder="Search for location"]',
    { visible: true, timeout: 15000 },
  )
  await locBox?.click({ count: 3 })
  await locBox?.type(loc)
  await page.keyboard.press('Enter')
  await delay(300)
}

async function scrollTrackListUntilVisible(page: Page, trackId: string) {
  const selector = `[data-testid="htsTrackLabel-Tracks,${trackId}"]`
  // The track list is virtualized, so scroll its container until the item renders
  for (let step = 0; step < 30; step++) {
    const found = await page.$(selector)
    if (found) {
      return found
    }
    await page.evaluate((s: number) => {
      // Find the scrollable track list container (overflowY:auto with scrollable content)
      const containers = Array.from(document.querySelectorAll<HTMLElement>('*'))
      const scrollable = containers.find(
        el =>
          window.getComputedStyle(el).overflowY === 'auto' &&
          el.scrollHeight > el.clientHeight + 10,
      )
      if (scrollable) {
        scrollable.scrollTop = s * 150
      }
    }, step)
    await delay(100)
  }
  return null
}

async function openTrack(page: Page, trackId: string) {
  const selector = `[data-testid="htsTrackLabel-Tracks,${trackId}"]`
  // First check if it's already in the DOM
  const quick = await page.$(selector)
  if (!quick) {
    await scrollTrackListUntilVisible(page, trackId)
  }
  const label = await page.waitForSelector(selector, { timeout: 5000 })
  await label?.click()
}

async function captureLGV(
  page: Page,
  spec: ScreenshotSpec & { mode?: 'lgv' },
  port: number,
) {
  const config = spec.config ?? VOLVOX_CONFIG
  await page.goto(
    `http://localhost:${port}/?config=${config}&sessionName=Screenshot`,
    { waitUntil: 'networkidle0', timeout: 60000 },
  )

  // Wait for the view to be fully initialized (ctgA appears in the default volvox session)
  await page.waitForSelector('::-p-text(ctgA)', {
    visible: true,
    timeout: 30000,
  })
  await waitForLoadingComplete(page, { waitForDownloads: true })

  if (spec.loc) {
    await setLocation(page, spec.loc)
    await delay(500)
  }

  for (const trackId of spec.openTracks ?? []) {
    await openTrack(page, trackId)
    await delay(300)
  }

  await waitForDisplaysDone(page, spec.settleMs ?? DEFAULT_SETTLE_MS)
}

async function debugDump(page: Page, name: string) {
  const bodyText = await page
    .evaluate(() => {
      const body = document.body
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      return body ? body.innerText.substring(0, 800) : ''
    })
    .catch(() => '')
  console.error(`    debug text: ${bodyText.replace(/\s+/g, ' ').trim()}`)
  const debugPath = path.join(outDir, `debug_${name.replace(/\//g, '_')}.png`)
  await page
    .screenshot()
    .then(png => {
      fs.writeFileSync(debugPath, png)
    })
    .catch(() => {})
  console.error(`    debug screenshot: ${debugPath}`)
}

async function captureUrl(
  page: Page,
  spec: ScreenshotSpec & { mode: 'url' },
  port: number,
) {
  const fullUrl = spec.url.startsWith('http')
    ? spec.url
    : `http://localhost:${port}/${spec.url}`
  await page.goto(fullUrl, {
    waitUntil:
      spec.waitUntil ??
      (spec.url.startsWith('http') ? 'domcontentloaded' : 'networkidle0'),
    timeout: 60000,
  })

  const readyTimeout = spec.readyTimeout ?? 30000
  if (spec.readyText) {
    await page
      .waitForSelector(`::-p-text(${spec.readyText})`, {
        visible: true,
        timeout: readyTimeout,
      })
      .catch(async (e: unknown) => {
        await debugDump(page, spec.name)
        throw e
      })
  }
  if (spec.readySelector) {
    await page
      .waitForSelector(spec.readySelector, {
        visible: true,
        timeout: readyTimeout,
      })
      .catch(async (e: unknown) => {
        await debugDump(page, spec.name)
        throw e
      })
  }

  await waitForLoadingComplete(page, { waitForDownloads: true })
  await waitForDisplaysDone(page, spec.settleMs ?? DEFAULT_SETTLE_MS)
}

const ANNOTATION_OVERLAY_ID = '__screenshot_annotation_overlay'

// Remove any annotation overlay left over from a previous frame so staged
// figures don't carry one stage's callouts into the next.
async function clearAnnotations(page: Page) {
  await page.evaluate(id => {
    document.getElementById(id)?.remove()
  }, ANNOTATION_OVERLAY_ID)
}

// Draw spec.annotations as a fixed SVG overlay covering the viewport so the
// callouts composite into the screenshot, reproducing the red arrows / boxes /
// text labels of hand-made teaching figures without an external image editor.
// Anchored annotations resolve their geometry from a live DOM element's bounding
// box at capture time, removing the need to hand-tune viewport coordinates.
async function drawAnnotations(page: Page, annotations: Annotation[]) {
  await clearAnnotations(page)
  await page.evaluate(
    (items, overlayId) => {
      const NS = 'http://www.w3.org/2000/svg'
      const svg = document.createElementNS(NS, 'svg')
      svg.id = overlayId
      svg.setAttribute(
        'style',
        'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none',
      )

      // Resolve an anchor to a live element: a CSS selector, or the
      // smallest-area element whose visible text matches (so a callout can point
      // at a menu item / button without a testid).
      function resolveAnchor(anchor: { selector?: string; text?: string }) {
        if (anchor.selector) {
          return document.querySelector(anchor.selector)
        }
        if (anchor.text) {
          const want = anchor.text.trim().toLowerCase()
          let best: Element | undefined
          let bestArea = Number.POSITIVE_INFINITY
          for (const el of document.querySelectorAll('body *')) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const txt = (el.textContent !== null ? el.textContent : '')
              .trim()
              .toLowerCase()
            const matches =
              txt === want || (el.childElementCount === 0 && txt.includes(want))
            const rect = el.getBoundingClientRect()
            const area = rect.width * rect.height
            if (
              matches &&
              rect.width > 0 &&
              rect.height > 0 &&
              area < bestArea
            ) {
              best = el
              bestArea = area
            }
          }
          return best ?? null
        }
        return null
      }

      // Apply anchoring: fill in x/y (element center) and, for box/ring shapes,
      // width/height (element bounds + padding), then nudge by dx/dy.
      const resolved = items.map(a => {
        const dx = a.dx ?? 0
        const dy = a.dy ?? 0
        if (!a.anchor) {
          return { ...a, x: (a.x ?? 0) + dx, y: (a.y ?? 0) + dy }
        }
        const el = resolveAnchor(a.anchor)
        if (!el) {
          return { ...a, x: (a.x ?? 0) + dx, y: (a.y ?? 0) + dy }
        }
        const r = el.getBoundingClientRect()
        const pad = 6
        // a numbered badge stays a fixed small disc; a hollow ring grows to wrap
        // the anchored element
        const ringRadius = Math.max(r.width, r.height) / 2 + pad
        return {
          ...a,
          x: a.type === 'box' ? r.left - pad + dx : r.left + r.width / 2 + dx,
          y: a.type === 'box' ? r.top - pad + dy : r.top + r.height / 2 + dy,
          width: a.width ?? r.width + pad * 2,
          height: a.height ?? r.height + pad * 2,
          radius: a.radius ?? (a.text ? 16 : ringRadius),
        }
      })

      const defs = document.createElementNS(NS, 'defs')
      const marker = document.createElementNS(NS, 'marker')
      marker.setAttribute('id', 'arrowhead')
      marker.setAttribute('markerWidth', '10')
      marker.setAttribute('markerHeight', '10')
      marker.setAttribute('refX', '8')
      marker.setAttribute('refY', '3')
      marker.setAttribute('orient', 'auto')
      const arrowPath = document.createElementNS(NS, 'path')
      arrowPath.setAttribute('d', 'M0,0 L8,3 L0,6 Z')
      arrowPath.setAttribute('fill', '#e3242b')
      marker.appendChild(arrowPath)
      defs.appendChild(marker)
      svg.appendChild(defs)
      // append the overlay now (before drawing) so text getBBox() resolves for
      // the optional background pill below
      document.body.appendChild(svg)
      for (const a of resolved) {
        const color = a.color ?? '#e3242b'
        const cx = a.x
        const cy = a.y
        if (a.type === 'arrow' && a.from) {
          // anchored arrow: head points at the resolved element center
          const headX = a.anchor ? cx : (a.to?.x ?? 0)
          const headY = a.anchor ? cy : (a.to?.y ?? 0)
          const line = document.createElementNS(NS, 'line')
          line.setAttribute('x1', String(a.from.x))
          line.setAttribute('y1', String(a.from.y))
          line.setAttribute('x2', String(headX))
          line.setAttribute('y2', String(headY))
          line.setAttribute('stroke', color)
          line.setAttribute('stroke-width', '4')
          line.setAttribute('marker-end', 'url(#arrowhead)')
          // recolor the shared arrowhead to match the last arrow's stroke
          arrowPath.setAttribute('fill', color)
          svg.appendChild(line)
        } else if (a.type === 'box') {
          const rect = document.createElementNS(NS, 'rect')
          rect.setAttribute('x', String(cx))
          rect.setAttribute('y', String(cy))
          rect.setAttribute('width', String(a.width ?? 0))
          rect.setAttribute('height', String(a.height ?? 0))
          rect.setAttribute('rx', '4')
          rect.setAttribute('fill', 'none')
          rect.setAttribute('stroke', color)
          rect.setAttribute('stroke-width', String(a.strokeWidth ?? 5))
          svg.appendChild(rect)
        } else if (a.type === 'circle') {
          const radius = a.radius ?? 16
          const circle = document.createElementNS(NS, 'circle')
          circle.setAttribute('cx', String(cx))
          circle.setAttribute('cy', String(cy))
          circle.setAttribute('r', String(radius))
          circle.setAttribute('stroke', color)
          circle.setAttribute('stroke-width', String(a.strokeWidth ?? 5))
          // filled badge when it carries a label, hollow ring otherwise
          circle.setAttribute('fill', a.text ? color : 'none')
          svg.appendChild(circle)
          if (a.text) {
            const text = document.createElementNS(NS, 'text')
            text.setAttribute('x', String(cx))
            text.setAttribute('y', String(cy))
            text.setAttribute('fill', a.textColor ?? '#fff')
            text.setAttribute('text-anchor', 'middle')
            text.setAttribute('dominant-baseline', 'central')
            text.setAttribute('font-family', 'system-ui, sans-serif')
            text.setAttribute('font-size', String(a.fontSize ?? 18))
            text.setAttribute('font-weight', '700')
            text.textContent = a.text
            svg.appendChild(text)
          }
        } else if (a.type === 'text' && a.text) {
          // Uniform callout style: white pill, red border, black text, larger
          // default font, with word-wrapping once a line exceeds maxWidth.
          const fontFamily = 'system-ui, sans-serif'
          const fontWeight = '600'
          const fontSize = Math.max(a.fontSize ?? 22, 18)
          const maxWidth = a.maxWidth ?? 420
          const measure = (s: string) => {
            const t = document.createElementNS(NS, 'text')
            t.setAttribute('font-family', fontFamily)
            t.setAttribute('font-size', String(fontSize))
            t.setAttribute('font-weight', fontWeight)
            t.textContent = s
            svg.appendChild(t)
            const w = t.getBBox().width
            svg.removeChild(t)
            return w
          }
          const lines: string[] = []
          let cur = ''
          for (const word of a.text.split(/\s+/)) {
            const test = cur ? `${cur} ${word}` : word
            if (cur && measure(test) > maxWidth) {
              lines.push(cur)
              cur = word
            } else {
              cur = test
            }
          }
          if (cur) {
            lines.push(cur)
          }
          const lineHeight = fontSize * 1.25
          const text = document.createElementNS(NS, 'text')
          text.setAttribute('x', String(cx))
          text.setAttribute('y', String(cy))
          text.setAttribute('fill', '#000')
          text.setAttribute('font-family', fontFamily)
          text.setAttribute('font-size', String(fontSize))
          text.setAttribute('font-weight', fontWeight)
          lines.forEach((ln, i) => {
            const tspan = document.createElementNS(NS, 'tspan')
            tspan.setAttribute('x', String(cx))
            tspan.setAttribute('dy', i === 0 ? '0' : String(lineHeight))
            tspan.textContent = ln
            text.appendChild(tspan)
          })
          svg.appendChild(text)
          const bbox = text.getBBox()
          const padX = 10
          const padY = 7
          const rect = document.createElementNS(NS, 'rect')
          rect.setAttribute('x', String(bbox.x - padX))
          rect.setAttribute('y', String(bbox.y - padY))
          rect.setAttribute('width', String(bbox.width + padX * 2))
          rect.setAttribute('height', String(bbox.height + padY * 2))
          rect.setAttribute('rx', '6')
          rect.setAttribute('fill', '#fff')
          rect.setAttribute('stroke', a.color ?? '#e3242b')
          rect.setAttribute('stroke-width', '3')
          svg.insertBefore(rect, text)
        }
      }
    },
    annotations,
    ANNOTATION_OVERLAY_ID,
  )
}

async function hideLingeringTooltip(page: Page) {
  // BaseTooltip renders into a portal with inline z-index:100000 (MUI menus
  // use 1300), so this targets the lingering hover tooltip without touching
  // the context menu we want to keep.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('div')) {
      if (el.style.zIndex === '100000') {
        el.style.display = 'none'
      }
    }
  })
}

// Apply the shared pre-shot steps (hide stray tooltip, draw/clear callouts,
// flush pending WebGL frames) then screenshot straight to `file`.
async function shoot(
  page: Page,
  spec: ScreenshotSpec,
  annotations: Annotation[] | undefined,
  file: string,
) {
  if (spec.hideTooltip) {
    await hideLingeringTooltip(page)
  }
  if (annotations && annotations.length > 0) {
    await drawAnnotations(page, annotations)
  } else {
    await clearAnnotations(page)
  }
  await page.evaluate(
    () =>
      new Promise<void>(resolve =>
        requestAnimationFrame(() => {
          resolve()
        }),
      ),
  )
  const clip = spec.crop
  await page.screenshot(clip ? { path: file, clip } : { path: file })
}

async function runActions(
  page: Page,
  name: string,
  actions: ScreenshotAction[] | undefined,
) {
  for (const action of actions ?? []) {
    await runAction(page, action).catch(async (e: unknown) => {
      await debugDump(page, name)
      throw e
    })
  }
}

// A regen re-renders every spec, but an unchanged spec re-renders byte-for-byte
// identical (rendering is deterministic). Writing them all back would churn the
// whole static/img dir on every commit. So a freshly captured PNG only replaces
// the committed one when it differs by more than `diffThreshold` of its pixels —
// the same diffFraction gate jbrowse-web/browser-tests/pngDiff.ts uses, here via
// ImageMagick `compare` (already a dependency alongside convert/pngquant)
// instead of pixelmatch.

// Fraction in [0,1] of pixels that differ (fuzz-tolerant), or null when the two
// images are different sizes / the comparison couldn't run (treated as changed).
function pngDiffFraction(a: string, b: string): number | null {
  // `compare` writes the metric to stderr and exits 0 (within fuzz), 1
  // (differ), or 2 (error, e.g. dimension mismatch).
  const cmp = spawnSync(
    'compare',
    ['-metric', 'AE', '-fuzz', '5%', a, b, 'null:'],
    { encoding: 'utf8' },
  )
  if (cmp.error || cmp.status === 2) {
    return null
  }
  const ae = Number.parseFloat((cmp.stderr || '').trim().split(/\s+/)[0] ?? '')
  if (!Number.isFinite(ae)) {
    return null
  }
  const id = spawnSync('identify', ['-format', '%w %h', a], {
    encoding: 'utf8',
  })
  const [w, h] = (id.stdout || '').trim().split(/\s+/).map(Number)
  const total = (w ?? 0) * (h ?? 0)
  return total > 0 ? ae / total : null
}

// Move a freshly captured PNG into place only when its content actually changed
// (or with --force / for a brand-new spec), so a regen doesn't rewrite every
// PNG. copyFileSync (not rename) because tmp and static/img may be on different
// filesystems.
function commitScreenshot(tmpPath: string, outputPath: string, name: string) {
  const isNew = !fs.existsSync(outputPath)
  if (force || isNew) {
    fs.copyFileSync(tmpPath, outputPath)
    fs.rmSync(tmpPath, { force: true })
    console.log(`  ✓ ${name}.png${isNew ? ' (new)' : ''}`)
    return
  }
  const frac = pngDiffFraction(tmpPath, outputPath)
  if (frac !== null && frac < diffThreshold) {
    fs.rmSync(tmpPath, { force: true })
    console.log(
      `  ≈ ${name}.png (kept; ${(frac * 100).toFixed(3)}% < ${diffThreshold * 100}% threshold)`,
    )
  } else {
    fs.copyFileSync(tmpPath, outputPath)
    fs.rmSync(tmpPath, { force: true })
    const detail =
      frac === null ? 'resized' : `${(frac * 100).toFixed(2)}% diff`
    console.log(`  ✓ ${name}.png (updated, ${detail})`)
  }
}

// Lossily quantize a PNG in place with pngquant. These captures are flat-color
// UI screenshots with small palettes, so quantization shrinks them ~50-60% with
// no perceptible quality loss — worth it for a static site served over the
// network. Best-effort: if pngquant isn't installed (or the result would be
// larger), leave the original untouched and keep going.
function optimizePng(file: string) {
  try {
    execFileSync(
      'pngquant',
      ['--quality=70-90', '--skip-if-larger', '--force', '--ext', '.png', file],
      { stdio: 'ignore' },
    )
  } catch (e) {
    // pngquant exits non-zero when it skips (e.g. --skip-if-larger), which is
    // fine; only surface a hint if the binary is genuinely missing
    if ((e as { code?: string }).code === 'ENOENT') {
      console.error('    pngquant not found; skipping image optimization')
    }
  }
}

async function captureSpec(page: Page, spec: ScreenshotSpec, port: number) {
  console.log(`  → ${spec.name}`)

  if (spec.mode === 'url') {
    await captureUrl(page, spec, port)
  } else {
    await captureLGV(page, spec, port)
  }

  await runActions(page, spec.name, spec.actions)
  await assertViewsRendered(page, spec.name)

  const outputPath = path.join(outDir, `${spec.name}.png`)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  // render into a temp file first; commitScreenshot decides whether it actually
  // replaces the committed PNG (content-stable diff gate)
  const safeSpecName = spec.name.replace(/\//g, '_')
  const renderPath = path.join(
    os.tmpdir(),
    `jb-final-${process.pid}-${safeSpecName}.png`,
  )

  if (spec.stages && spec.stages.length > 0) {
    // capture each stage to a temp file, then stack them vertically with
    // ImageMagick (`convert f0 f1 -append`), the same composition the hand-made
    // two-stage teaching figures used
    const stageFiles = spec.stages.map((_, i) =>
      path.join(os.tmpdir(), `jb-shot-${process.pid}-${safeSpecName}-${i}.png`),
    )
    for (const [i, stage] of spec.stages.entries()) {
      if (stage.closeMenusFirst) {
        await page.keyboard.press('Escape')
        await delay(300)
      }
      // drop the previous stage's annotation overlay before this stage acts on
      // the page, so its SVG callout text can't be matched by a ::-p-text() click
      // target in this stage's actions
      await clearAnnotations(page)
      await runActions(page, spec.name, stage.actions)
      await shoot(page, spec, stage.annotations, stageFiles[i]!)
    }
    execFileSync('convert', [...stageFiles, '-append', renderPath])
    for (const f of stageFiles) {
      fs.rmSync(f, { force: true })
    }
  } else {
    await shoot(page, spec, spec.annotations, renderPath)
  }
  optimizePng(renderPath)
  commitScreenshot(renderPath, outputPath, spec.name)
}

async function main() {
  const filteredSpecs = filter
    ? specs.filter(s => (exact ? s.name === filter : s.name.includes(filter)))
    : specs

  if (filteredSpecs.length === 0) {
    console.error(`No specs match filter: ${filter}`)
    process.exit(1)
  }

  console.log(
    `Generating ${filteredSpecs.length} screenshot(s)${filter ? ` (filter: ${filter})` : ''}`,
  )

  const needsLocalServer = filteredSpecs.some(
    s => s.mode !== 'url' || !s.url.startsWith('http'),
  )

  let server: Server | undefined
  const port = DEFAULT_PORT

  if (needsLocalServer) {
    if (!externalPort && !fs.existsSync(buildPath)) {
      console.error(
        `Build not found at ${buildPath}. Run "pnpm build" in products/jbrowse-web first, or pass --port=N to use an existing server.`,
      )
      process.exit(1)
    }
    server = await createTestServer(port, {
      jbrowseWebRoot: testDataRoot,
      repoRoot,
      proxyPort: externalPort,
    })
    console.log(
      externalPort
        ? `Proxy on port ${port}, app on port ${externalPort}`
        : `Server on port ${port}`,
    )
  }

  const executablePath = findChromeExecutable()

  const launchOptions = {
    headless: !headed,
    executablePath,
    args: [...BASE_CHROME_ARGS, '--enable-unsafe-swiftshader'],
    // wider viewport for more genomic context; deviceScaleFactor 2 keeps the
    // capture hidpi/retina-crisp (2x backing store) at the larger size
    defaultViewport: { width: 1500, height: 800, deviceScaleFactor: 2 },
  }
  const { width: vpWidth, deviceScaleFactor } = launchOptions.defaultViewport

  let passed = 0
  let failed = 0
  const failures: string[] = []

  async function runSpec(spec: ScreenshotSpec) {
    if (spec.curated) {
      console.log(`  ⊘ ${spec.name} (curated, keeping committed image)`)
      return
    }
    // Fresh browser per spec to avoid service worker caching between navigations
    const browser = await launch(launchOptions)
    try {
      const page = await browser.newPage()
      if (spec.viewportHeight || spec.viewportWidth) {
        await page.setViewport({
          width: spec.viewportWidth ?? vpWidth,
          height: spec.viewportHeight ?? 800,
          deviceScaleFactor,
        })
      }
      page.on('console', msg => {
        const t = msg.type()
        if (!isBrowserConsoleNoise(msg.text())) {
          console.error(`    browser[${t}]: ${msg.text().substring(0, 300)}`)
        }
      })
      await captureSpec(page, spec, port)
      passed++
    } catch (err) {
      console.error(`  ✗ ${spec.name}: ${err}`)
      failed++
      failures.push(spec.name)
    } finally {
      await browser.close()
    }
  }

  console.log(`Running with concurrency ${CONCURRENCY}`)

  try {
    // Pool: keep CONCURRENCY browsers running at once
    const queue = [...filteredSpecs]
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const spec = queue.shift()!
        await runSpec(spec)
      }
    })
    await Promise.all(workers)
  } finally {
    server?.close()
  }

  console.log(`\n${passed} succeeded, ${failed} failed`)
  if (failures.length > 0) {
    console.error('Failed:', failures.join(', '))
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
