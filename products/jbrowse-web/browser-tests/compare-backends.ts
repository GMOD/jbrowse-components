/* eslint-disable no-console */
import fs from 'fs'
import { Buffer } from 'node:buffer'
import path from 'path'
import { fileURLToPath } from 'url'

import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { launch } from 'puppeteer'

import { PORT } from './helpers.ts'
import { buildPath, startServer } from './server.ts'

import type { ElementHandle, Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.resolve(__dirname, '__compare__')

interface SessionSpec {
  name: string
  spec: Record<string, unknown>
  canvasSelector: string
  waitForSelector: string
  delayMs?: number
}

const sessions: SessionSpec[] = [
  {
    name: 'wiggle-gc-content',
    spec: {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:39,433..39,804',
          tracks: ['volvox_gc'],
        },
      ],
    },
    waitForSelector: '[data-testid="wiggle-rendering-test"]',
    canvasSelector: '[data-testid="wiggle-rendering-test"] canvas',
  },
  {
    name: 'sequence-display',
    spec: {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1..200',
          tracks: ['volvox_refseq'],
        },
      ],
    },
    waitForSelector: '[data-testid^="prerendered_canvas"]',
    canvasSelector: '[data-testid^="prerendered_canvas"]',
  },
  {
    name: 'variant-track',
    spec: {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:2,849..3,099',
          tracks: ['volvox_filtered_vcf_assembly_alias'],
        },
      ],
    },
    waitForSelector: '[data-testid^="prerendered_canvas"]',
    canvasSelector: '[data-testid^="prerendered_canvas"]',
  },
  {
    name: 'multibigwig-xyplot',
    spec: {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-4000',
          tracks: ['volvox_microarray_multi'],
        },
      ],
    },
    waitForSelector: '[data-testid^="trackRenderingContainer"] canvas',
    canvasSelector: '[data-testid^="trackRenderingContainer"] canvas',
    delayMs: 3000,
  },
]

async function captureCanvas(
  page: Page,
  session: SessionSpec,
  gpuParam: string,
) {
  const specParam = encodeURIComponent(JSON.stringify(session.spec))
  const url = `http://localhost:${PORT}/?config=test_data/volvox/config.json&session=spec-${specParam}&sessionName=Test%20Session&gpu=${gpuParam}`
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })
  await page.waitForSelector(session.waitForSelector, { timeout: 60000 })
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="loading-overlay"]').length === 0,
    { timeout: 30000 },
  )
  await new Promise(r => setTimeout(r, session.delayMs ?? 1000))

  const el = (await page.waitForSelector(session.canvasSelector, {
    timeout: 60000,
  })) as ElementHandle<HTMLCanvasElement> | null
  if (!el) {
    throw new Error(`Canvas not found: ${session.canvasSelector}`)
  }

  const pngBase64 = await page.evaluate(canvas => {
    return canvas.toDataURL('image/png').split(',')[1]!
  }, el)
  return Buffer.from(pngBase64, 'base64')
}

async function main() {
  if (!fs.existsSync(buildPath)) {
    console.error(
      'Error: Build directory not found. Run `yarn build` in products/jbrowse-web first.',
    )
    process.exit(1)
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  console.log('Starting test server...')
  const server = await startServer(PORT)

  const webglBrowser = await launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--use-gl=angle',
      '--use-angle=swiftshader',
    ],
    defaultViewport: { width: 1280, height: 800 },
  })

  const webgpuBrowser = await launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan',
    ],
    defaultViewport: { width: 1280, height: 800 },
  })

  try {
    const webglPage = await webglBrowser.newPage()
    const webgpuPage = await webgpuBrowser.newPage()

    console.log(`\nComparing ${sessions.length} sessions across backends...\n`)

    const results: { name: string; diffPercent: number; status: string }[] = []

    for (const session of sessions) {
      process.stdout.write(`  ${session.name}...`)

      try {
        const [webglPng, webgpuPng] = await Promise.all([
          captureCanvas(webglPage, session, 'webgl'),
          captureCanvas(webgpuPage, session, 'webgpu'),
        ])

        fs.writeFileSync(
          path.join(outputDir, `${session.name}-webgl.png`),
          webglPng,
        )
        fs.writeFileSync(
          path.join(outputDir, `${session.name}-webgpu.png`),
          webgpuPng,
        )

        // @ts-expect-error Uint8Array works at runtime
        const webglImg = PNG.sync.read(webglPng)
        // @ts-expect-error Uint8Array works at runtime
        const webgpuImg = PNG.sync.read(webgpuPng)

        if (
          webglImg.width !== webgpuImg.width ||
          webglImg.height !== webgpuImg.height
        ) {
          results.push({
            name: session.name,
            diffPercent: 100,
            status: `size mismatch: ${webglImg.width}x${webglImg.height} vs ${webgpuImg.width}x${webgpuImg.height}`,
          })
          console.log(' SIZE MISMATCH')
          continue
        }

        const { width, height } = webglImg
        const diffImg = new PNG({ width, height })
        const numDiffPixels = pixelmatch(
          webglImg.data,
          webgpuImg.data,
          diffImg.data,
          width,
          height,
          { threshold: 0.1 },
        )

        const diffPercent = (numDiffPixels / (width * height)) * 100

        fs.writeFileSync(
          path.join(outputDir, `${session.name}-diff.png`),
          PNG.sync.write(diffImg),
        )

        const status =
          diffPercent < 1 ? 'OK' : diffPercent < 5 ? 'WARN' : 'DRIFT'
        results.push({ name: session.name, diffPercent, status })
        console.log(` ${diffPercent.toFixed(2)}% diff [${status}]`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        results.push({
          name: session.name,
          diffPercent: -1,
          status: `ERROR: ${msg}`,
        })
        console.log(` ERROR: ${msg}`)
      }
    }

    console.log(`\n${'─'.repeat(60)}`)
    console.log('  Backend Comparison Report')
    console.log('─'.repeat(60))
    for (const r of results) {
      const pct = r.diffPercent >= 0 ? `${r.diffPercent.toFixed(2)}%` : 'N/A'
      console.log(`  ${r.name.padEnd(30)} ${pct.padStart(8)}  ${r.status}`)
    }
    console.log('─'.repeat(60))
    console.log(`  Output saved to: ${outputDir}`)
    console.log()

    const hasIssues = results.some(r => r.diffPercent < 0 || r.diffPercent >= 5)
    process.exit(hasIssues ? 1 : 0)
  } finally {
    await webglBrowser.close()
    await webgpuBrowser.close()
    server.close()
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()
