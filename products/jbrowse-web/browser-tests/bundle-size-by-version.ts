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
import { execFileSync } from 'child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs'
import { createServer } from 'http'
import { extname, join, normalize } from 'path'
import { gzipSync } from 'zlib'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'
import handler from 'serve-handler'

const CACHE_DIR = process.env.JB_BENCH_CACHE || '/tmp/jb-bench-versions'
const PORT = 3346
const HERE = new URL('.', import.meta.url).pathname
const JBROWSE_WEB_ROOT = join(HERE, '..')
const LOCAL_BUILD = join(JBROWSE_WEB_ROOT, 'build')

const CORS = [
  { source: '**/*', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] },
]

// gzip the text assets a real static host would, so the CDP encodedDataLength
// puppeteer reports is the realistic over-the-wire transfer size (not raw).
const COMPRESSIBLE: Record<string, string> = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
  '.txt': 'text/plain',
}
const gzipCache = new Map<string, Buffer>()

function resolveFile(
  reqUrl: string,
  root: string,
  testDataRoot: string | undefined,
) {
  const pathname = decodeURIComponent(new URL(reqUrl, 'http://x').pathname)
  const base =
    testDataRoot !== undefined && pathname.startsWith('/test_data/')
      ? testDataRoot
      : root
  const fp = normalize(join(base, pathname === '/' ? '/index.html' : pathname))
  return { fp, base, inside: fp.startsWith(base) }
}

// Range (206) requests — required by the .2bit/.bai adapters — and binary
// assets fall through to serve-handler. Full-file text requests get gzipped
// here so the measured JS bytes match a production deploy.
function startServer(root: string, port: number, testDataRoot?: string) {
  const server = createServer((req, res) => {
    const { fp, base, inside } = resolveFile(req.url ?? '/', root, testDataRoot)
    const type = COMPRESSIBLE[extname(fp)]
    const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')
    const isFile = inside && existsSync(fp) && statSync(fp).isFile()
    if (type && acceptsGzip && !req.headers.range && isFile) {
      let buf = gzipCache.get(fp)
      if (!buf) {
        buf = gzipSync(readFileSync(fp))
        gzipCache.set(fp, buf)
      }
      res.writeHead(200, {
        'content-type': type,
        'content-encoding': 'gzip',
        'content-length': buf.length,
        vary: 'Accept-Encoding',
        'access-control-allow-origin': '*',
      })
      res.end(buf)
    } else {
      void handler(req, res, { public: base, headers: CORS })
    }
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
  return measureDir(version, ensureCreated(version))
}

async function measureDir(
  version: string,
  dir: string,
  testDataRoot?: string,
): Promise<Sample> {
  const server = await startServer(dir, PORT, testDataRoot)
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
  const localIdx = argv.indexOf('--local')
  const afterLocal = localIdx >= 0 ? argv[localIdx + 1] : undefined
  return {
    all: argv.includes('--all'),
    explicit: get('--versions')?.split(','),
    min: get('--min'),
    // --local [label]: also measure products/jbrowse-web/build, label it, and
    // merge into the existing JSON. Defaults the label to the git branch.
    local: localIdx >= 0,
    localLabel:
      afterLocal && !afterLocal.startsWith('--') ? afterLocal : undefined,
  }
}

const isSemver = (v: string) => /^v\d+\.\d+\.\d+$/.test(v)

// Released versions sort by semver; non-semver labels (the local build) sort
// last so they land at the right edge of the chart.
function cmpVersion(a: string, b: string) {
  if (isSemver(a) !== isSemver(b)) {
    return isSemver(a) ? -1 : 1
  }
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) {
      return (pa[i] || 0) - (pb[i] || 0)
    }
  }
  return 0
}

function gitBranch() {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: JBROWSE_WEB_ROOT,
    encoding: 'utf8',
  }).trim()
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
<text x="${padL}" y="48" font-size="12" fill="#555">green = track rendered, red = render not detected. gzipped JS encodedDataLength (real over-the-wire transfer).</text>
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

const log1 = (s: Sample) =>
  { console.log(
    `    JS ${Math.round(s.jsBytes / 1024)} KB in ${s.jsCount} reqs | all ${Math.round(s.allBytes / 1024)} KB | rendered=${s.rendered}`,
  ) }

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const jsonPath = join(HERE, 'bundle-size-by-version.json')
  const svgPath = join(HERE, 'bundle-size-by-version.svg')

  // Pre-existing results merged into, so `--local` can append without
  // re-measuring every release.
  const byVersion = new Map<string, Sample>()
  if (existsSync(jsonPath)) {
    for (const s of JSON.parse(readFileSync(jsonPath, 'utf8')) as Sample[]) {
      byVersion.set(s.version, s)
    }
  }

  const wantReleases = args.all || !!args.explicit || !!args.min || !args.local
  if (wantReleases) {
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
    console.log(`Measuring ${versions.length} releases:\n  ${versions.join(', ')}\n`)
    for (const v of versions) {
      console.log(`==> ${v}`)
      try {
        const s = await measureVersion(v)
        byVersion.set(v, s)
        log1(s)
      } catch (e) {
        console.error(`    FAILED ${v}:`, (e as Error).message)
      }
    }
  }

  if (args.local) {
    const label = args.localLabel || `${gitBranch()} (local)`
    console.log(`==> ${label} (build dir ${LOCAL_BUILD})`)
    if (existsSync(join(LOCAL_BUILD, 'index.html'))) {
      const s = await measureDir(label, LOCAL_BUILD, JBROWSE_WEB_ROOT)
      byVersion.set(label, s)
      log1(s)
    } else {
      console.error(`    no build found — run: pnpm --filter @jbrowse/web build`)
    }
  }

  const samples = [...byVersion.values()].sort((a, b) =>
    cmpVersion(a.version, b.version),
  )
  writeFileSync(jsonPath, JSON.stringify(samples, null, 2))
  writeFileSync(svgPath, renderSvg(samples))
  console.log(`\n${asciiChart(samples)}\n`)
  console.log(`wrote ${jsonPath}`)
  console.log(`wrote ${svgPath}`)
  process.exit(0)
}

void main()
