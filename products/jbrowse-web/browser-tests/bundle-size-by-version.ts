/* eslint-disable no-console */
// Measure the JS bytes-over-the-wire needed to boot a Linear Genome View and
// open a gene track, across released JBrowse versions. For each version we
// `jbrowse create --tag <v>` into a cache dir, serve that folder, drive it with
// the URL-param API (assembly/loc/tracks), and sum CDP encodedDataLength for JS.
//
// Output: JSON (bundle-size-by-version.json) + an SVG bar chart
// (bundle-size-by-version.svg).
//
// Usage:
//   node browser-tests/bundle-size-by-version.ts                 # decimated set
//   node browser-tests/bundle-size-by-version.ts --all           # every version
//   node browser-tests/bundle-size-by-version.ts --versions v4.3.0,v3.0.0
//   node browser-tests/bundle-size-by-version.ts --min v2.0.0    # floor
import { createServer } from 'http'
import { execFileSync } from 'child_process'
import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'
import handler from 'serve-handler'

const CACHE_DIR = process.env.JB_BENCH_CACHE || '/tmp/jb-bench-versions'
const PORT = 3346
const HERE = new URL('.', import.meta.url).pathname

// Serve the whole jbrowse-create folder (index.html, static/, test_data/) from
// one root. serve-handler does Range (206) requests, which the .2bit/.bai
// adapters require, plus correct content-types.
function startServer(root: string, port: number) {
  const server = createServer((req, res) => {
    void handler(req, res, {
      public: root,
      headers: [
        {
          source: '**/*',
          headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
        },
      ],
    })
  })
  return new Promise<typeof server>(resolve => {
    server.listen(port, () => {
      resolve(server)
    })
  })
}

function ensureCreated(version: string) {
  const dir = join(CACHE_DIR, version)
  const ready = existsSync(join(dir, 'index.html'))
  if (ready) {
    console.log(`  cached: ${dir}`)
  } else {
    console.log(`  jbrowse create --tag ${version} ...`)
    execFileSync('jbrowse', ['create', dir, '--tag', version, '--force'], {
      stdio: 'inherit',
    })
  }
  return dir
}

interface Sample {
  version: string
  jsBytes: number
  jsCount: number
  allBytes: number
  rendered: boolean
}

async function measureVersion(version: string): Promise<Sample> {
  const dir = ensureCreated(version)
  const server = await startServer(dir, PORT)
  const browser = await launch({ headless: true, args: BASE_CHROME_ARGS })
  try {
    const page = await browser.newPage()
    const client = await page.createCDPSession()
    await client.send('Network.enable')

    const urlByReq = new Map<string, string>()
    let jsBytes = 0
    let jsCount = 0
    let allBytes = 0
    client.on('Network.responseReceived', (e: any) => {
      urlByReq.set(e.requestId, e.response.url)
    })
    client.on('Network.loadingFinished', (e: any) => {
      const url = urlByReq.get(e.requestId) || ''
      const len = e.encodedDataLength || 0
      allBytes += len
      if (url.endsWith('.js') || url.includes('.js?')) {
        jsBytes += len
        jsCount++
      }
    })

    // assembly/loc/tracks URL params open an LGV at a locus with the named
    // track. This API predates session-specs, so it works across old + new.
    const u = new URL(`http://localhost:${PORT}/`)
    u.searchParams.set('config', 'test_data/volvox/config.json')
    u.searchParams.set('assembly', 'volvox')
    u.searchParams.set('loc', 'ctgA:1-50,000')
    u.searchParams.set('tracks', 'gff3tabix_genes')
    await page.goto(u.href, { waitUntil: 'networkidle0', timeout: 90000 })

    // Version-agnostic "track painted" signal: the gene track's rendering
    // container holds real feature content. New versions paint <canvas>; older
    // ones (LinearBasicDisplay) emit <svg>/<image>. Never fatal — bytes are
    // already captured by networkidle0.
    const rendered = await page
      .waitForFunction(
        () => {
          const c = document.querySelector(
            '[data-testid^="trackRenderingContainer"][data-testid*="gff3tabix_genes"]',
          )
          return !!c?.querySelector('canvas, svg, image, img')
        },
        { timeout: 20000 },
      )
      .then(() => true)
      .catch(() => false)
    await new Promise(r => setTimeout(r, 1500))

    return { version, jsBytes, jsCount, allBytes, rendered }
  } finally {
    await browser.close()
    server.close()
  }
}

// Keep newest of every minor, then thin the rest, so the chart shows the trend
// without 80 nearly-identical bars.
function decimate(versions: string[]) {
  const seenMinor = new Set<string>()
  return versions.filter(v => {
    const [maj, min] = v.replace(/^v/, '').split('.')
    const key = `${maj}.${min}`
    const first = !seenMinor.has(key)
    seenMinor.add(key)
    return first
  })
}

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  return {
    all: argv.includes('--all'),
    explicit: get('--versions')?.split(','),
    min: get('--min'),
  }
}

function cmpVersion(a: string, b: string) {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) {
      return (pa[i] || 0) - (pb[i] || 0)
    }
  }
  return 0
}

function listVersions() {
  const out = execFileSync('jbrowse', ['create', '--listVersions'], {
    encoding: 'utf8',
  })
  return out
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^v\d+\.\d+\.\d+$/.test(l)) // drop betas/headers
}

function renderSvg(samples: Sample[]) {
  const k = (n: number) => Math.round(n / 1024)
  const W = 1100
  const barH = 26
  const gap = 8
  const padL = 90
  const padR = 90
  const padT = 60
  const max = Math.max(...samples.map(s => s.jsBytes), 1)
  const plotW = W - padL - padR
  const H = padT + samples.length * (barH + gap) + 30
  const rows = samples
    .map((s, i) => {
      const y = padT + i * (barH + gap)
      const w = (s.jsBytes / max) * plotW
      return [
        `<text x="${padL - 8}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="13" font-family="monospace">${s.version}</text>`,
        `<rect x="${padL}" y="${y}" width="${w.toFixed(1)}" height="${barH}" fill="${s.rendered ? '#2e7d32' : '#c62828'}" rx="3"/>`,
        `<text x="${padL + w + 6}" y="${y + barH / 2 + 4}" font-size="12" font-family="monospace">${k(s.jsBytes)} KB${s.rendered ? '' : ' (no render)'}</text>`,
      ].join('\n')
    })
    .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif">
<rect width="${W}" height="${H}" fill="white"/>
<text x="${padL}" y="30" font-size="20" font-weight="bold">JS bytes over the wire: boot LGV + open gene track (volvox)</text>
<text x="${padL}" y="48" font-size="12" fill="#555">green = track rendered, red = render not detected. Raw (uncompressed) JS encodedDataLength.</text>
${rows}
</svg>`
}

function asciiChart(samples: Sample[]) {
  const k = (n: number) => Math.round(n / 1024)
  const max = Math.max(...samples.map(s => s.jsBytes), 1)
  const width = 40
  return samples
    .map(s => {
      const bar = '█'.repeat(Math.round((s.jsBytes / max) * width))
      const flag = s.rendered ? ' ' : '!'
      return `${s.version.padEnd(9)}${flag}${bar.padEnd(width)} ${String(k(s.jsBytes)).padStart(5)} KB  (${s.jsCount} js)`
    })
    .join('\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const available = listVersions()
  let versions: string[]
  if (args.explicit) {
    versions = args.explicit
  } else {
    const min = args.min || 'v2.0.0'
    const floored = available.filter(v => cmpVersion(v, min) >= 0)
    versions = args.all ? floored : decimate(floored)
  }
  versions = [...versions].sort(cmpVersion)

  console.log(`Measuring ${versions.length} versions:\n  ${versions.join(', ')}\n`)
  const samples: Sample[] = []
  for (const v of versions) {
    console.log(`==> ${v}`)
    try {
      const s = await measureVersion(v)
      samples.push(s)
      console.log(
        `    JS ${Math.round(s.jsBytes / 1024)} KB in ${s.jsCount} reqs | all ${Math.round(s.allBytes / 1024)} KB | rendered=${s.rendered}`,
      )
    } catch (e) {
      console.error(`    FAILED ${v}:`, (e as Error).message)
    }
  }

  const jsonPath = join(HERE, 'bundle-size-by-version.json')
  const svgPath = join(HERE, 'bundle-size-by-version.svg')
  writeFileSync(jsonPath, JSON.stringify(samples, null, 2))
  writeFileSync(svgPath, renderSvg(samples))
  console.log(`\n${asciiChart(samples)}\n`)
  console.log(`wrote ${jsonPath}`)
  console.log(`wrote ${svgPath}`)
  process.exit(0)
}

void main()
