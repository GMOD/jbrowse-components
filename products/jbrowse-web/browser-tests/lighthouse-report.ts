/* eslint-disable no-console */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { executablePath } from 'puppeteer'

import { startServer } from './server.ts'

// Lighthouse over the built app. jbrowse-web is an SPA whose whole point is the
// canvas that appears after data loads, so treat the perf metrics (FCP/LCP/TBT)
// as the signal and ignore the SEO/PWA audits.
//
//   node browser-tests/lighthouse-report.ts [scenario]

const PORT = 3348

const SCENARIOS: Record<string, string> = {
  shell: 'config=test_data/volvox/config.json&renderer=canvas2d',
  track:
    'config=test_data/volvox/config.json&renderer=canvas2d&sessionName=M&session=%7B%22views%22%3A%5B%7B%22type%22%3A%22LinearGenomeView%22%2C%22assembly%22%3A%22volvox%22%2C%22loc%22%3A%22ctgA%3A1-50000%22%2C%22tracks%22%3A%5B%22volvox_microarray_line%22%5D%7D%5D%7D',
}

async function main() {
  const scenario = process.argv[2] ?? 'shell'
  const query = SCENARIOS[scenario]
  if (!query) {
    console.error(`scenarios: ${Object.keys(SCENARIOS).join(', ')}`)
    process.exit(1)
  }
  const server = await startServer(PORT)
  const chromePath = await executablePath()
  const out = path.join(os.tmpdir(), `lh-${scenario}.json`)
  try {
    execFileSync(
      'npx',
      [
        '-y',
        'lighthouse@12',
        `http://localhost:${PORT}/?${query}`,
        '--only-categories=performance',
        '--output=json',
        `--output-path=${out}`,
        '--quiet',
        `--chrome-flags=${['--headless=new', ...BASE_CHROME_ARGS].join(' ')}`,
      ],
      { stdio: 'inherit', env: { ...process.env, CHROME_PATH: chromePath } },
    )
  } finally {
    server.close()
  }

  const lhr = JSON.parse(fs.readFileSync(out, 'utf8'))
  console.log(`\n=== lighthouse: ${scenario} ===`)
  console.log(
    `performance score ${Math.round((lhr.categories.performance.score ?? 0) * 100)}`,
  )
  for (const id of [
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'speed-index',
    'cumulative-layout-shift',
    'interactive',
    'max-potential-fid',
    'server-response-time',
    'mainthread-work-breakdown',
    'bootup-time',
  ]) {
    const a = lhr.audits[id]
    if (a) {
      console.log(`  ${id.padEnd(28)} ${a.displayValue ?? a.score}`)
    }
  }

  console.log('\n-- opportunities / diagnostics with headroom --')
  for (const a of Object.values<any>(lhr.audits)) {
    const savings =
      a.details?.overallSavingsBytes ?? a.details?.overallSavingsMs ?? 0
    if (savings > 0 && a.score !== null && a.score < 1) {
      console.log(
        `  ${a.id.padEnd(34)} ${a.displayValue ?? ''}${
          a.details?.overallSavingsBytes
            ? ` (${(a.details.overallSavingsBytes / 1024).toFixed(0)} KB)`
            : ''
        }`,
      )
    }
  }

  const unused = lhr.audits['unused-javascript']
  for (const item of unused?.details?.items ?? []) {
    console.log(
      `  unused-js  ${(item.wastedBytes / 1024).toFixed(0).padStart(5)} KB of ${(
        item.totalBytes / 1024
      )
        .toFixed(0)
        .padStart(5)} KB  ${String(item.url).split('/').pop()}`,
    )
  }

  const mainthread = lhr.audits['mainthread-work-breakdown']
  for (const item of mainthread?.details?.items ?? []) {
    console.log(
      `  mainthread ${item.duration.toFixed(0).padStart(6)} ms  ${item.groupLabel}`,
    )
  }
  process.exit(0)
}

void main()
