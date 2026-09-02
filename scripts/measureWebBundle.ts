/**
 * What does jbrowse-web actually download before it can draw?
 *
 *   pnpm --filter @jbrowse/web build && pnpm measure-web-bundle
 *
 * Serves products/jbrowse-web/build, opens it in headless Chrome on two
 * volvox pages — an empty LinearGenomeView and one with four tracks of
 * different display types — records every script the browser fetched before
 * the app-ready marker (and the displays' drawn marks), and gzips those files
 * from disk. On-disk chunk sizes say nothing about which chunks a page load
 * pulls in; the network does. Then attributes the fetched bytes to packages
 * through the source maps, so a "why is X eager" has a first answer.
 *
 *   --files <prefix>   also list the individual source files under a prefix
 *                      (e.g. plugins/ or packages/core/) by estimated gzip share
 *   --time             time to the app-ready marker and to the drawn displays,
 *                      median of five loads, over an emulated 4 Mbps / 40 ms
 *                      link — the bytes only matter through this number
 *   --build <dir>      measure another build directory (a second checkout)
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

import puppeteer from 'puppeteer'

const root = path.resolve(import.meta.dirname, '..')
const argAfter = (flag: string) =>
  process.argv.includes(flag)
    ? process.argv[process.argv.indexOf(flag) + 1]
    : undefined
const buildDir =
  argAfter('--build') ?? path.join(root, 'products/jbrowse-web/build')
const port = 8137
const filesPrefix = argAfter('--files')
const timing = process.argv.includes('--time')

const scenarios = {
  emptyLGV: { url: '/?config=test_data/volvox/config.json', drawn: 0 },
  fourTracks: {
    url: '/?config=test_data/volvox/config.json&assembly=volvox&loc=ctgA:1-50000&tracks=volvox_alignments,volvox_microarray,gff3tabix_genes,volvox_test_vcf',
    drawn: 4,
  },
}

function gz(rel: string) {
  const file = path.join(buildDir, rel)
  return {
    raw: statSync(file).size,
    gzip: gzipSync(readFileSync(file), { level: 9 }).length,
  }
}

function packageOf(source: string) {
  const pnpm = [
    ...source.matchAll(
      /node_modules\/\.pnpm\/[^/]+\/node_modules\/((?:@[^/]+\/)?[^/]+)/g,
    ),
  ]
  const m = pnpm.length
    ? pnpm[pnpm.length - 1]
    : /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(source)
  return m
    ? `npm:${m[1]}`
    : source
        .replace(/^webpack:\/\/@jbrowse\/web\/\.\.\//, '')
        .split('/src/')[0]!
}

function attribute(chunks: { k: string; gzip: number }[]) {
  const byPkg = new Map<string, number>()
  const byFile = new Map<string, number>()
  for (const { k, gzip } of chunks) {
    const mapFile = path.join(buildDir, `${k}.map`)
    if (!existsSync(mapFile)) {
      continue
    }
    const map = JSON.parse(readFileSync(mapFile, 'utf8')) as {
      sources: string[]
      sourcesContent?: (string | null)[]
    }
    const lengths = map.sources.map(
      (_, i) => map.sourcesContent?.[i]?.length ?? 0,
    )
    const total = lengths.reduce((a, b) => a + b, 0)
    map.sources.forEach((s, i) => {
      const share = total ? (lengths[i]! / total) * gzip : 0
      const pkg = packageOf(s)
      byPkg.set(pkg, (byPkg.get(pkg) ?? 0) + share)
      const rel = s.replace(/^webpack:\/\/@jbrowse\/web\/\.\.\//, '')
      if (filesPrefix && rel.startsWith(filesPrefix)) {
        byFile.set(rel, (byFile.get(rel) ?? 0) + share)
      }
    })
  }
  return { byPkg, byFile }
}

const kb = (b: number) => `${(b / 1024).toFixed(0)} KB`

const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
}
// keep-alive HTTP/1.1, so a page that fetches more, smaller chunks is not
// charged a TCP handshake per chunk the way python's http.server would
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const file = path.join(
    buildDir,
    url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname),
  )
  if (existsSync(file) && statSync(file).isFile()) {
    res.writeHead(200, {
      'content-type':
        mimeTypes[path.extname(file)] ?? 'application/octet-stream',
      'content-length': statSync(file).size,
    })
    createReadStream(file).pipe(res)
  } else {
    res.writeHead(404)
    res.end()
  }
})
await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve))

async function load(sc: { url: string; drawn: number }, throttle: boolean) {
  const page = await browser.newPage()
  if (throttle) {
    const client = await page.createCDPSession()
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 40,
      downloadThroughput: (4 * 1024 * 1024) / 8,
      uploadThroughput: (2 * 1024 * 1024) / 8,
    })
  }
  const fetched = new Set<string>()
  page.on('response', res => {
    const { pathname } = new URL(res.url())
    if (/\/static\/js\/.*\.js$/.test(pathname)) {
      fetched.add(pathname.replace(/^\//, ''))
    }
  })
  const errors: string[] = []
  page.on('pageerror', e => {
    errors.push(String(e))
  })
  const t0 = performance.now()
  await page.goto(`http://127.0.0.1:${port}${sc.url}`, {
    waitUntil: 'load',
    timeout: 120000,
  })
  await page.waitForSelector('[data-app-phase="ready"]', { timeout: 120000 })
  const ready = performance.now() - t0
  if (sc.drawn > 0) {
    await page.waitForFunction(
      (n: number) =>
        document.querySelectorAll('[data-display-drawn="true"]').length >= n,
      { timeout: 120000 },
      sc.drawn,
    )
  }
  const drawn = performance.now() - t0
  await new Promise(resolve => setTimeout(resolve, 2000))
  await page.close()
  return { fetched, errors, ready, drawn }
}

const median = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!

const browser = await puppeteer.launch({ headless: true })
try {
  for (const [name, sc] of Object.entries(scenarios)) {
    if (timing) {
      const runs = []
      for (let i = 0; i < 5; i++) {
        runs.push(await load(sc, true))
      }
      console.log(
        `\n## ${name} over 4 Mbps / 40 ms, median of 5: app ready ${median(runs.map(r => r.ready)).toFixed(0)} ms${sc.drawn ? `, ${sc.drawn} displays drawn ${median(runs.map(r => r.drawn)).toFixed(0)} ms` : ''}`,
      )
    } else {
      const { fetched, errors } = await load(sc, false)
      const chunks = [...fetched]
        .map(k => ({ k, ...gz(k) }))
        .sort((a, b) => b.gzip - a.gzip)
      const gzip = chunks.reduce((a, c) => a + c.gzip, 0)
      const raw = chunks.reduce((a, c) => a + c.raw, 0)
      console.log(
        `\n## ${name}: ${chunks.length} chunks, ${kb(gzip)} gzipped (${kb(raw)} raw)${errors.length ? `, page errors: ${errors.join('; ')}` : ''}`,
      )
      for (const c of chunks.slice(0, 8)) {
        console.log(
          `  ${kb(c.gzip).padStart(8)}  ${c.k.replace('static/js/', '')}`,
        )
      }
      const { byPkg, byFile } = attribute(chunks)
      console.log('  by package (estimated gzip share):')
      for (const [pkg, b] of [...byPkg]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)) {
        console.log(`  ${kb(b).padStart(8)}  ${pkg}`)
      }
      if (filesPrefix) {
        console.log(`  files under ${filesPrefix}:`)
        for (const [f, b] of [...byFile]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 40)) {
          console.log(`  ${(b / 1024).toFixed(1).padStart(8)} KB  ${f}`)
        }
      }
    }
  }
} finally {
  await browser.close()
  server.close()
}
