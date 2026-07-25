/* eslint-disable no-console */
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { buildPath, startServer } from './server.ts'

// Attribute bundle bytes to source modules for ONE page load. Everything in
// jbrowse is heavily lazy-loaded, so summing the whole build says nothing about
// what a user waits for: we take the chunks the page actually requested (CDP
// encodedDataLength) and roll up only the modules webpack placed in them.
//
//   node browser-tests/analyze-loaded-bundles.ts [scenario] [--top=N]
//
// Requires a build made with stats: `node scripts/build.ts --stats`.

interface StatsModule {
  name?: string
  size?: number
  chunks?: (string | number)[]
  modules?: StatsModule[]
}

interface Stats {
  chunks: {
    id: string | number
    files?: string[]
    names?: string[]
  }[]
  modules: StatsModule[]
}

const SCENARIOS = {
  shell: {
    label: 'cold app shell (canvas2d, no session)',
    query: 'config=test_data/volvox/config.json&renderer=canvas2d',
    waitSelector: '#root *',
  },
  'shell-webgl': {
    label: 'cold app shell (webgl, no session)',
    query: 'config=test_data/volvox/config.json&renderer=webgl',
    waitSelector: '#root *',
  },
  track: {
    label: 'one wiggle track (canvas2d)',
    query: `config=test_data/volvox/config.json&sessionName=M&renderer=canvas2d&session=${encodeSessionSpec(
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'volvox',
            loc: 'ctgA:1-50000',
            tracks: ['volvox_microarray_line'],
          },
        ],
      },
    )}`,
    waitSelector: '[data-testid$="-done"]',
  },
  alignments: {
    label: 'one alignments track (webgl)',
    query: `config=test_data/volvox/config.json&sessionName=M&renderer=webgl&session=${encodeSessionSpec(
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'volvox',
            loc: 'ctgA:1-50000',
            tracks: ['volvox_alignments'],
          },
        ],
      },
    )}`,
    waitSelector: '[data-testid$="-done"]',
  },
}

function bucketOf(name: string) {
  const nm = name.lastIndexOf('node_modules/')
  if (nm !== -1) {
    const rest = name.slice(nm + 'node_modules/'.length).split('/')
    return `npm:${rest[0]!.startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0]}`
  }
  const ws = /(?:^|\/)(packages|plugins|products)\/([^/]+)\//.exec(name)
  return ws ? `${ws[1]}/${ws[2]}` : 'other'
}

// A concatenated module reports its own rolled-up size plus the inner modules it
// swallowed; recurse so bytes land on the file that owns them.
function* leaves(m: StatsModule): Generator<{ name: string; size: number }> {
  if (m.modules?.length) {
    for (const inner of m.modules) {
      yield* leaves(inner)
    }
  } else if (m.name) {
    yield { name: m.name, size: m.size ?? 0 }
  }
}

async function collectLoadedFiles(port: number, scenario: string) {
  const s = SCENARIOS[scenario as keyof typeof SCENARIOS]
  const browser = await launch({
    headless: true,
    args: [
      ...BASE_CHROME_ARGS,
      '--use-gl=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  })
  const page = await browser.newPage()
  const client = await page.createCDPSession()
  await client.send('Network.enable')

  const urlByReq = new Map<string, string>()
  const wire = new Map<string, number>()
  client.on('Network.responseReceived', (e: any) => {
    urlByReq.set(e.requestId, e.response.url)
  })
  client.on('Network.loadingFinished', (e: any) => {
    const url = urlByReq.get(e.requestId)
    if (url?.includes('.js')) {
      const file = url.split('/').pop()!.split('?')[0]!
      wire.set(file, (wire.get(file) ?? 0) + (e.encodedDataLength ?? 0))
    }
  })

  await page.goto(`http://localhost:${port}/?${s.query}`, {
    waitUntil: 'networkidle0',
    timeout: 90000,
  })
  await page.waitForSelector(s.waitSelector, { timeout: 60000 }).catch(() => {})
  await new Promise(r => setTimeout(r, 1500))
  await browser.close()
  return wire
}

async function main() {
  const scenario = process.argv[2]?.startsWith('--')
    ? 'shell'
    : (process.argv[2] ?? 'shell')
  const top = Number(
    process.argv.find(a => a.startsWith('--top='))?.slice(6) ?? 25,
  )
  if (!(scenario in SCENARIOS)) {
    console.error(`scenarios: ${Object.keys(SCENARIOS).join(', ')}`)
    process.exit(1)
  }
  const statsPath = path.join(buildPath, 'bundle-stats.json')
  if (!fs.existsSync(statsPath)) {
    console.error(
      `no ${statsPath}\nrun: NODE_ENV=production node scripts/build.ts --stats`,
    )
    process.exit(1)
  }

  const server = await startServer(3347)
  const wire = await collectLoadedFiles(3347, scenario)
  server.close()

  const stats: Stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'))
  const chunkOfFile = new Map<string, string | number>()
  for (const c of stats.chunks) {
    for (const f of c.files ?? []) {
      chunkOfFile.set(path.basename(f), c.id)
    }
  }

  const loadedChunks = new Set<string | number>()
  const unmatched: string[] = []
  for (const file of wire.keys()) {
    const id = chunkOfFile.get(file)
    if (id === undefined) {
      unmatched.push(file)
    } else {
      loadedChunks.add(id)
    }
  }

  const byBucket = new Map<string, number>()
  const byModule = new Map<string, number>()
  let attributed = 0
  for (const m of stats.modules) {
    if (!m.chunks?.some(c => loadedChunks.has(c))) {
      continue
    }
    for (const leaf of leaves(m)) {
      attributed += leaf.size
      byBucket.set(
        bucketOf(leaf.name),
        (byBucket.get(bucketOf(leaf.name)) ?? 0) + leaf.size,
      )
      byModule.set(leaf.name, (byModule.get(leaf.name) ?? 0) + leaf.size)
    }
  }

  const k = (n: number) => `${(n / 1024).toFixed(1)} KB`
  // the test server does not compress, so encodedDataLength is minified-but-raw;
  // gzip the file on disk to get what a real deployment would ship
  const gzipOf = (file: string) => {
    const p = path.join(buildPath, 'static/js', file)
    return fs.existsSync(p) ? gzipSync(fs.readFileSync(p)).length : 0
  }
  const chunkFiles = [...wire]
    .filter(([f]) => chunkOfFile.has(f))
    .map(([file, raw]) => ({ file, raw, gz: gzipOf(file) }))
    .sort((a, b) => b.raw - a.raw)
  const rawTotal = chunkFiles.reduce((a, b) => a + b.raw, 0)
  const gzTotal = chunkFiles.reduce((a, b) => a + b.gz, 0)

  const s = SCENARIOS[scenario as keyof typeof SCENARIOS]
  console.log(`\n=== ${s.label} ===`)
  console.log(
    `${chunkFiles.length} JS chunks: ${k(rawTotal)} minified, ${k(gzTotal)} gzipped`,
  )
  console.log(
    `${k(attributed)} of source attributed to those chunks (raw, pre-minify)`,
  )
  if (unmatched.length) {
    console.log(`non-chunk requests ignored: ${unmatched.join(', ')}`)
  }

  console.log('\n-- chunks pulled, largest first --')
  for (const { file, raw, gz } of chunkFiles) {
    const names = stats.chunks
      .find(c => c.id === chunkOfFile.get(file))
      ?.names?.join(',')
    console.log(
      `${k(raw).padStart(10)} min  ${k(gz).padStart(9)} gz  ${file}${names ? `  (${names})` : ''}`,
    )
  }

  const shaderBytes = [...byModule]
    .filter(([n]) => n.includes('.generated.ts'))
    .sort((a, b) => b[1] - a[1])
  if (shaderBytes.length) {
    console.log(
      `\n-- generated shader source in those chunks: ${k(
        shaderBytes.reduce((a, b) => a + b[1], 0),
      )} --`,
    )
    for (const [name, bytes] of shaderBytes.slice(0, 12)) {
      console.log(`${k(bytes).padStart(10)}  ${name.replace(/^.*\/src\//, '')}`)
    }
  }

  console.log(`\n-- top ${top} packages in those chunks (raw source bytes) --`)
  for (const [b, bytes] of [...byBucket]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)) {
    console.log(
      `${k(bytes).padStart(10)}  ${((bytes / attributed) * 100).toFixed(1).padStart(5)}%  ${b}`,
    )
  }

  console.log(`\n-- top ${top} individual modules --`)
  for (const [name, bytes] of [...byModule]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)) {
    console.log(`${k(bytes).padStart(10)}  ${name}`)
  }
  process.exit(0)
}

void main()
