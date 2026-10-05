/* eslint-disable no-console */
// Cold-load time to a drawn BAM track across released JBrowse Web versions:
// a fresh browser per load, every version served by the same HTTP/2 server,
// once on a local server and once behind an emulated round trip. Plot with
// load-time-by-version.R.
//
//   node browser-tests/load-time-by-version.ts [--root=/tmp/jb-load-versions]
//     [--versions=v4.3.0,v5.0.0-beta.11] [--local=main=build] [--rounds=6]
//     [--latencies=0,80]
//
// Each version is `<root>/<version>/build`, downloaded from its GitHub release
// with `gh` when missing; `--local=<name>=<dir>` adds an unreleased build. The
// session is a minimal volvox config every version since v2 reads, opened with
// the assembly/loc/tracks URL params. Where a version marks its track drawn
// differs (`prerendered_canvas_*_done` before v5, `data-display-drawn` from
// it), so a calibration load counts each version's settled marks and a timed
// load ends when it reaches them.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  BASE_CHROME_ARGS,
  createSecureTestServer,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { collectTimedRequests } from './cdpNetwork.ts'
import { localhostCert } from './server.ts'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const HERE = path.dirname(new URL(import.meta.url).pathname)
const root = flag('root') ?? path.join(os.tmpdir(), 'jb-load-versions')
const releases = (
  flag('versions') ??
  'v2.1.7,v2.5.0,v2.10.0,v2.15.0,v3.0.0,v3.6.5,v4.0.3,v4.3.0,v5.0.0-beta.1,v5.0.0-beta.11'
).split(',')
const locals = new Map(
  process.argv
    .filter(a => a.startsWith('--local='))
    .map(a => a.slice('--local='.length).split('=') as [string, string]),
)
const rounds = Number(flag('rounds') ?? 6)
const latencies = (flag('latencies') ?? '0,80').split(',').map(Number)
const out = path.join(HERE, 'load-time-by-version.csv')
const volvox = path.join(HERE, '..', 'test_data', 'volvox')

const config = {
  assemblies: [
    {
      name: 'volvox',
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'volvox_refseq',
        adapter: {
          type: 'TwoBitAdapter',
          twoBitLocation: { uri: 'volvox.2bit', locationType: 'UriLocation' },
        },
      },
    },
  ],
  tracks: [
    {
      type: 'AlignmentsTrack',
      trackId: 'volvox_bam',
      name: 'volvox-sorted.bam',
      assemblyNames: ['volvox'],
      adapter: {
        type: 'BamAdapter',
        bamLocation: { uri: 'volvox-sorted.bam', locationType: 'UriLocation' },
        index: {
          location: {
            uri: 'volvox-sorted.bam.bai',
            locationType: 'UriLocation',
          },
          indexType: 'BAI',
        },
      },
    },
  ],
}
const query =
  'config=test_data/vv/config.json&assembly=volvox&loc=ctgA:1-20000&tracks=volvox_bam'

function prepareData() {
  const dir = path.join(root, 'data')
  fs.mkdirSync(dir, { recursive: true })
  for (const f of [
    'volvox.2bit',
    'volvox-sorted.bam',
    'volvox-sorted.bam.bai',
  ]) {
    fs.copyFileSync(path.join(volvox, f), path.join(dir, f))
  }
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config))
  return dir
}

function prepareVersion(name: string, data: string, localBuild?: string) {
  const dir = path.join(root, name)
  const build = path.join(dir, 'build')
  fs.mkdirSync(dir, { recursive: true })
  if (localBuild) {
    fs.rmSync(build, { recursive: true, force: true })
    fs.symlinkSync(path.resolve(localBuild), build)
  } else if (!fs.existsSync(path.join(build, 'index.html'))) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `jbweb-${name}-`))
    execFileSync(
      'gh',
      ['release', 'download', name, '--repo', 'GMOD/jbrowse-components'],
      { stdio: 'inherit', cwd: tmp, env: { ...process.env } },
    )
    const zip = path.join(tmp, `jbrowse-web-${name}.zip`)
    execFileSync('unzip', ['-q', zip, '-d', path.join(tmp, 'x')])
    const index = execFileSync('find', [
      path.join(tmp, 'x'),
      '-name',
      'index.html',
    ])
      .toString()
      .split('\n')[0]!
    fs.renameSync(path.dirname(index), build)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  const testData = path.join(dir, 'test_data')
  fs.mkdirSync(testData, { recursive: true })
  fs.rmSync(path.join(testData, 'vv'), { recursive: true, force: true })
  fs.symlinkSync(data, path.join(testData, 'vv'))
  return dir
}

function tagDate(name: string) {
  const ref = locals.has(name) ? 'HEAD' : name
  return execFileSync('git', ['log', '-1', '--format=%cs', ref])
    .toString()
    .trim()
}

function counts() {
  const prerendered = 'canvas[data-testid^="prerendered_canvas"]'
  return {
    done: document.querySelectorAll(`${prerendered}[data-testid$="_done"]`)
      .length,
    pending: document.querySelectorAll(
      `${prerendered}:not([data-testid$="_done"])`,
    ).length,
    drawn: document.querySelectorAll('[data-display-drawn="true"]').length,
    undrawn: document.querySelectorAll(
      '[data-display-drawn]:not([data-display-drawn="true"])',
    ).length,
  }
}

type Target = Pick<ReturnType<typeof counts>, 'done' | 'drawn'>

const tls = localhostCert()
const args = [
  ...BASE_CHROME_ARGS,
  `--ignore-certificate-errors-spki-list=${tls.spki}`,
]

async function calibrate(url: string) {
  const browser = await launch({ headless: true, args })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1400, height: 900 })
    await page.goto(url)
    let last = ''
    let stable = 0
    for (let i = 0; i < 60 && stable < 6; i++) {
      await new Promise(r => setTimeout(r, 500))
      const now = JSON.stringify(await page.evaluate(counts))
      stable = now === last ? stable + 1 : 0
      last = now
    }
    return (await page.evaluate(counts)) as Target
  } finally {
    await browser.close()
  }
}

async function timedLoad(url: string, latency: number, target: Target) {
  const browser = await launch({ headless: true, args })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1400, height: 900 })
    if (latency) {
      await collectTimedRequests(page, latency)
    }
    await page.evaluateOnNewDocument(
      (countsSource: string, t: Target) => {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const count = new Function(`return (${countsSource})()`) as () => {
          done: number
          pending: number
          drawn: number
          undrawn: number
        }
        const w = window as unknown as { readyAt?: number }
        const tick = () => {
          const c = count()
          if (
            c.done >= t.done &&
            c.drawn >= t.drawn &&
            c.pending === 0 &&
            c.undrawn === 0
          ) {
            w.readyAt = performance.now()
          } else {
            requestAnimationFrame(tick)
          }
        }
        requestAnimationFrame(tick)
      },
      counts.toString(),
      target,
    )
    await page.goto(url)
    await page.waitForFunction(
      () => (window as unknown as { readyAt?: number }).readyAt !== undefined,
      { timeout: 60_000, polling: 50 },
    )
    const readyAt = await page.evaluate(
      () => (window as unknown as { readyAt: number }).readyAt,
    )
    return readyAt
  } finally {
    await browser.close()
  }
}

const data = prepareData()
const names = [...releases, ...locals.keys()]
const urls = new Map<string, string>()
let port = 3400
for (const name of names) {
  const dir = prepareVersion(name, data, locals.get(name))
  await createSecureTestServer(port, {
    jbrowseWebRoot: dir,
    repoRoot: dir,
    key: tls.key,
    cert: tls.cert,
  })
  urls.set(name, `https://localhost:${port}/?${query}`)
  port++
}

const targets = new Map<string, Target>()
for (const name of names) {
  const t = await calibrate(urls.get(name)!)
  if (t.done + t.drawn === 0) {
    throw new Error(`${name} drew nothing; check its build`)
  }
  console.log(`${name}: settles at ${JSON.stringify(t)}`)
  targets.set(name, t)
}

const rows = ['version,date,latency_ms,round,load_ms']
for (let r = 0; r < rounds; r++) {
  for (const latency of latencies) {
    for (const name of r % 2 ? [...names].reverse() : names) {
      const ms = await timedLoad(urls.get(name)!, latency, targets.get(name)!)
      rows.push(`${name},${tagDate(name)},${latency},${r},${Math.round(ms)}`)
      console.log(rows.at(-1))
    }
  }
}
fs.writeFileSync(out, `${rows.join('\n')}\n`)
console.log(`wrote ${out}`)
process.exit(0)
