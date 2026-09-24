/* eslint-disable no-console */
// How a cold load behaves when every request costs a round trip: when the RPC
// worker starts, when its first data request goes out, how many of its code
// fetches waited on the one before, and in how many rounds the page fetched
// its own chunks. The byte harnesses beside this one cannot see any of that,
// and a local load with no latency hides it, since a round trip costs nothing.
//
//   node browser-tests/measure-load-latency.ts [--latency=100] [--runs=3]
//     [--only=hub] [--base=https://jbrowse.org/code/jb2/main/] [--waterfall]
//     [--http1]
//
// Run after a build. The server speaks HTTP/2 and sends the deploy's
// Cache-Control for static/; --http1 serves HTTP/1.1, whose six connections a
// host queue a round of chunks. --base measures a deployed copy instead, whose
// remote requests pay their real round trip on top of the emulated one.
// --waterfall prints every request.
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { collectTimedRequests, isJsUrl } from './cdpNetwork.ts'
import {
  localhostCert,
  startSecureServerOnFreePort,
  startServerOnFreePort,
} from './server.ts'

import type { TimedRequest } from './cdpNetwork.ts'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const arg = (name: string, fallback: number) => Number(flag(name) ?? fallback)
const latency = arg('latency', 100)
const runs = arg('runs', 3)
const only = flag('only')
const base = flag('base')
const waterfall = process.argv.includes('--waterfall')
const http1 = process.argv.includes('--http1')

const scenarios = {
  'volvox, 4 tracks':
    'config=test_data/volvox/config.json&assembly=volvox&loc=ctgA:1000-6000&tracks=volvox_filtered_vcf,volvox_microarray,volvox_cram_alignments_ctga,gff3tabix_genes',
  'hg38 hub, its default session':
    'config=https://jbrowse.org/ucsc/hg38/config.json',
}

const isPluginUrl = (url: string) => url.includes('/plugins/')

function summarize(requests: TimedRequest[], readyMs: number) {
  const settled = requests.filter(r => r.end !== undefined && r.start < readyMs)
  const workerJs = settled.filter(r => r.inWorker && isJsUrl(r.url))
  const workerData = settled.filter(r => r.inWorker && !isJsUrl(r.url))
  const serialWorkerLoads = workerJs.filter((r, i) =>
    i > 0 ? r.start >= workerJs[i - 1]!.end! - 1 : false,
  ).length
  const pageJs = settled.filter(r => !r.inWorker && r.url.includes('/static/'))
  let pageRounds = 0
  let roundStart = -Infinity
  for (const r of pageJs) {
    if (r.start - roundStart > 40) {
      pageRounds++
      roundStart = r.start
    }
  }
  const pluginEnd = (inWorker: boolean) =>
    Math.max(
      ...settled
        .filter(r => r.inWorker === inWorker && isPluginUrl(r.url))
        .map(r => r.end!),
    )
  const firstData = workerData[0]
  const pageDataBefore = settled.filter(
    r =>
      !r.inWorker &&
      !isJsUrl(r.url) &&
      !r.url.includes('/static/') &&
      firstData !== undefined &&
      r.end! <= firstData.start,
  )
  return {
    readyMs,
    firstWorkerRequestMs: workerJs[0]?.start,
    firstDataRequestMs: firstData?.start,
    // how long the worker's first data request trailed the last file the page
    // itself read first (the assembly's, on these scenarios)
    workerLagMs:
      firstData && pageDataBefore.length
        ? firstData.start - Math.max(...pageDataBefore.map(r => r.end!))
        : undefined,
    serialWorkerLoads: `${serialWorkerLoads}/${Math.max(workerJs.length - 1, 0)}`,
    pageRounds,
    pagePluginsMs: pluginEnd(false),
    workerPluginsMs: pluginEnd(true),
  }
}

function printWaterfall(requests: TimedRequest[], readyMs: number) {
  for (const r of requests.filter(r => r.start < readyMs)) {
    const end = r.end === undefined ? '    -' : r.end.toFixed(0).padStart(5)
    const url = r.url.startsWith('data:') ? 'data:' : r.url.split('?')[0]
    console.log(
      `    ${r.start.toFixed(0).padStart(5)} ${end} ${r.inWorker ? 'W' : ' '} ${url}`,
    )
  }
}

async function measure(root: string, query: string, chromeArgs: string[]) {
  const browser = await launch({
    headless: true,
    args: [...BASE_CHROME_ARGS, ...chromeArgs],
  })
  try {
    const page = await browser.newPage()
    const requests = await collectTimedRequests(page, latency)
    await page.evaluateOnNewDocument(() => {
      new MutationObserver((_, observer) => {
        if (document.querySelector('[data-app-phase="ready"]')) {
          ;(window as { readyAt?: number }).readyAt = performance.now()
          observer.disconnect()
        }
      }).observe(document, {
        subtree: true,
        childList: true,
        attributeFilter: ['data-app-phase'],
      })
    })
    await page.goto(`${root}?${query}`)
    await page.waitForFunction(
      () => (window as { readyAt?: number }).readyAt !== undefined,
      { timeout: 120_000 },
    )
    const readyMs = await page.evaluate(
      () => (window as { readyAt?: number }).readyAt!,
    )
    if (waterfall) {
      printWaterfall(requests(), readyMs)
    }
    return summarize(requests(), readyMs)
  } finally {
    await browser.close()
  }
}

async function main() {
  const tls = base || http1 ? undefined : localhostCert()
  const local = base
    ? undefined
    : tls
      ? await startSecureServerOnFreePort(3360, tls)
      : await startServerOnFreePort(3360)
  const root = base ?? `${tls ? 'https' : 'http'}://localhost:${local!.port}/`
  const chromeArgs = tls
    ? [`--ignore-certificate-errors-spki-list=${tls.spki}`]
    : []
  const ms = (n: number | undefined) =>
    n === undefined || !Number.isFinite(n) ? '-' : `${(n / 1000).toFixed(2)} s`
  console.log(`${root}, ${latency} ms round trip, ${runs} cold loads each\n`)
  for (const [name, query] of Object.entries(scenarios)) {
    if (only && !name.includes(only)) {
      continue
    }
    console.log(name)
    for (let i = 0; i < runs; i++) {
      const r = await measure(root, query, chromeArgs)
      console.log(
        `  ready ${ms(r.readyMs)} | worker's first request ${ms(r.firstWorkerRequestMs)} | first data request ${ms(r.firstDataRequestMs)}, ${ms(r.workerLagMs)} after the page's last read | worker loads that waited on the previous ${r.serialWorkerLoads} | page chunk rounds ${r.pageRounds} | plugins loaded: page ${ms(r.pagePluginsMs)}, worker ${ms(r.workerPluginsMs)}`,
      )
    }
  }
  local?.server.close()
  process.exit(0)
}

void main()
