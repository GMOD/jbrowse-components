/* eslint-disable no-console */
import { execFileSync } from 'child_process'
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

import { launch } from 'puppeteer'
import handler from 'serve-handler'

import { specs } from './screenshot-specs.ts'

import type {
  Annotation,
  ScreenshotAction,
  ScreenshotSpec,
} from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const cliArgs = process.argv.slice(2)
const headed = cliArgs.includes('--headed')
const filterArg = cliArgs.find(a => a.startsWith('--filter='))
const filter = filterArg?.split('=')[1]
const exact = cliArgs.includes('--exact')
const portArg = cliArgs.find(a => a.startsWith('--port='))
const externalPortVal = portArg ? Number(portArg.split('=')[1]) : Number.NaN
const externalPort = Number.isFinite(externalPortVal)
  ? externalPortVal
  : undefined
const DEFAULT_PORT = 3334

const repoRoot = path.resolve(__dirname, '..', '..')
const buildPath = path.resolve(repoRoot, 'products', 'jbrowse-web', 'build')
const testDataRoot = path.resolve(repoRoot, 'products', 'jbrowse-web')
const outDir = path.resolve(__dirname, '..', 'static', 'img')
const VOLVOX_CONFIG = 'test_data/volvox/config.json'
const DEFAULT_SETTLE_MS = 2500

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function proxyToPort(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  targetPort: number,
) {
  const options: http.RequestOptions = {
    hostname: 'localhost',
    port: targetPort,
    path: req.url ?? '/',
    method: req.method,
    headers: req.headers,
  }
  const proxyReq = http.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers)
    proxyRes.pipe(res, { end: true })
  })
  proxyReq.on('error', err => {
    console.error(`    proxy error: ${err.message}`)
    res.writeHead(502)
    res.end('Bad Gateway')
  })
  req.pipe(proxyReq, { end: true })
}

function startServer(port: number, proxyPort?: number): Promise<http.Server> {
  const corsHeaders = [
    {
      source: '**/*',
      headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
    },
  ]
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? '/'
      if (url.startsWith('/test_data/')) {
        return handler(req, res, { public: testDataRoot, headers: corsHeaders })
      } else if (url.startsWith('/extra_test_data/')) {
        return handler(req, res, { public: repoRoot, headers: corsHeaders })
      } else if (proxyPort !== undefined) {
        proxyToPort(req, res, proxyPort)
      } else {
        return handler(req, res, { public: buildPath, headers: corsHeaders })
      }
    })
    server.on('error', reject)
    server.listen(port, () => {
      resolve(server)
    })
  })
}

async function waitForLoadingComplete(page: Page, timeout = 30000) {
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="loading-overlay"]').length === 0,
    { timeout },
  )
  // The loading-overlay testid can clear while a track is still fetching (the
  // overlay tracks an earlier phase than e.g. a remote BAM download). Adapters
  // surface in-progress fetches as "Downloading …" status text; wait for those
  // to clear so we don't capture a half-loaded track. Best-effort: a slow
  // remote source may exceed the timeout, in which case the settle below still
  // applies.
  await page
    .waitForFunction(() => !document.body.innerText.includes('Downloading'), {
      timeout,
    })
    .catch(() => {})
}

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
      await el?.click()
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
      await el?.click({ count: 3 })
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
  await waitForLoadingComplete(page)

  if (spec.loc) {
    await setLocation(page, spec.loc)
    await delay(500)
  }

  for (const trackId of spec.openTracks ?? []) {
    await openTrack(page, trackId)
    await delay(300)
  }

  await delay(spec.settleMs ?? DEFAULT_SETTLE_MS)
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

  await waitForLoadingComplete(page)
  await delay(spec.settleMs ?? DEFAULT_SETTLE_MS)
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
          rect.setAttribute('stroke-width', '3')
          svg.appendChild(rect)
        } else if (a.type === 'circle') {
          const radius = a.radius ?? 16
          const circle = document.createElementNS(NS, 'circle')
          circle.setAttribute('cx', String(cx))
          circle.setAttribute('cy', String(cy))
          circle.setAttribute('r', String(radius))
          circle.setAttribute('stroke', color)
          circle.setAttribute('stroke-width', '3')
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
          const text = document.createElementNS(NS, 'text')
          text.setAttribute('x', String(cx))
          text.setAttribute('y', String(cy))
          text.setAttribute('fill', a.textColor ?? color)
          text.setAttribute('font-family', 'system-ui, sans-serif')
          text.setAttribute('font-size', String(a.fontSize ?? 18))
          text.setAttribute('font-weight', '600')
          text.textContent = a.text
          svg.appendChild(text)
          if (a.background) {
            // draw a rounded pill behind the text (inserted before it) so the
            // label reads over busy page content
            const bbox = text.getBBox()
            const padX = 8
            const padY = 5
            const rect = document.createElementNS(NS, 'rect')
            rect.setAttribute('x', String(bbox.x - padX))
            rect.setAttribute('y', String(bbox.y - padY))
            rect.setAttribute('width', String(bbox.width + padX * 2))
            rect.setAttribute('height', String(bbox.height + padY * 2))
            rect.setAttribute('rx', '5')
            rect.setAttribute('fill', a.background)
            svg.insertBefore(rect, text)
          }
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

  if (spec.stages && spec.stages.length > 0) {
    // capture each stage to a temp file, then stack them vertically with
    // ImageMagick (`convert f0 f1 -append`), the same composition the hand-made
    // two-stage teaching figures used
    const stageFiles = spec.stages.map((_, i) =>
      path.join(os.tmpdir(), `jb-shot-${process.pid}-${i}.png`),
    )
    for (const [i, stage] of spec.stages.entries()) {
      if (stage.closeMenusFirst) {
        await page.keyboard.press('Escape')
        await delay(300)
      }
      await runActions(page, spec.name, stage.actions)
      await shoot(page, spec, stage.annotations, stageFiles[i]!)
    }
    execFileSync('convert', [...stageFiles, '-append', outputPath])
    for (const f of stageFiles) {
      fs.rmSync(f, { force: true })
    }
  } else {
    await shoot(page, spec, spec.annotations, outputPath)
  }
  console.log(`  ✓ ${spec.name}.png`)
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

  let server: http.Server | undefined
  const port = DEFAULT_PORT

  if (needsLocalServer) {
    if (!externalPort && !fs.existsSync(buildPath)) {
      console.error(
        `Build not found at ${buildPath}. Run "pnpm build" in products/jbrowse-web first, or pass --port=N to use an existing server.`,
      )
      process.exit(1)
    }
    server = await startServer(port, externalPort)
    console.log(
      externalPort
        ? `Proxy on port ${port}, app on port ${externalPort}`
        : `Server on port ${port}`,
    )
  }

  const chromePaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ]
  const executablePath = chromePaths.find(p => fs.existsSync(p))

  const launchOptions = {
    headless: !headed,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--enable-unsafe-swiftshader',
    ],
    // wider viewport for more genomic context; deviceScaleFactor 2 keeps the
    // capture hidpi/retina-crisp (2x backing store) at the larger size
    defaultViewport: { width: 1500, height: 800, deviceScaleFactor: 2 },
  }
  const { width: vpWidth, deviceScaleFactor } = launchOptions.defaultViewport

  let passed = 0
  let failed = 0
  const failures: string[] = []

  try {
    for (const spec of filteredSpecs) {
      // Curated specs keep a hand-picked / real-data PNG that the volvox spec
      // body can't reproduce; skip so a regen never overwrites the committed
      // image (the spec body stays as documentation).
      if (spec.curated) {
        console.log(`  ⊘ ${spec.name} (curated, keeping committed image)`)
        continue
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
          if (
            !msg.text().includes('favicon') &&
            !msg.text().includes('WebGL') &&
            !msg.text().includes('GroupMarker') &&
            !msg.text().includes('GPU stall')
          ) {
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
