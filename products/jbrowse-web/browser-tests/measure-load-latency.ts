/* eslint-disable no-console */
// How a cold load behaves when every request costs a round trip: when the RPC
// worker starts, when its first data request goes out, how many of its code
// fetches waited on the one before, and in how many rounds the page fetched
// its own chunks. The byte harnesses beside this one cannot see any of that,
// and a local load with no latency hides it, since a round trip costs nothing.
//
//   node browser-tests/measure-load-latency.ts [--latency=100] [--runs=3]
//
// Run after a build. The server sends the deploy's Cache-Control for static/.
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { collectTimedRequests, isJsUrl } from './cdpNetwork.ts'
import { startServerOnFreePort } from './server.ts'

import type { TimedRequest } from './cdpNetwork.ts'

const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )
const latency = arg('latency', 100)
const runs = arg('runs', 3)

const scenarios = {
  'volvox, 4 tracks':
    'config=test_data/volvox/config.json&assembly=volvox&loc=ctgA:1000-6000&tracks=volvox_filtered_vcf,volvox_microarray,volvox_cram_alignments_ctga,gff3tabix_genes',
}

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
  return {
    readyMs,
    firstWorkerRequestMs: workerJs[0]?.start,
    firstDataRequestMs: workerData[0]?.start,
    serialWorkerLoads: `${serialWorkerLoads}/${Math.max(workerJs.length - 1, 0)}`,
    pageRounds,
  }
}

async function measure(port: number, query: string) {
  const browser = await launch({ headless: true, args: BASE_CHROME_ARGS })
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
    await page.goto(`http://localhost:${port}/?${query}`)
    await page.waitForFunction(
      () => (window as { readyAt?: number }).readyAt !== undefined,
      { timeout: 120_000 },
    )
    const readyMs = await page.evaluate(
      () => (window as { readyAt?: number }).readyAt!,
    )
    return summarize(requests(), readyMs)
  } finally {
    await browser.close()
  }
}

async function main() {
  const { server, port } = await startServerOnFreePort(3360)
  const ms = (n: number | undefined) =>
    n === undefined ? '-' : `${(n / 1000).toFixed(2)} s`
  console.log(`${latency} ms round trip, ${runs} cold loads each\n`)
  for (const [name, query] of Object.entries(scenarios)) {
    console.log(name)
    for (let i = 0; i < runs; i++) {
      const r = await measure(port, query)
      console.log(
        `  ready ${ms(r.readyMs)} | worker's first request ${ms(r.firstWorkerRequestMs)} | first data request ${ms(r.firstDataRequestMs)} | worker loads that waited on the previous ${r.serialWorkerLoads} | page chunk rounds ${r.pageRounds}`,
      )
    }
  }
  server.close()
  process.exit(0)
}

void main()
