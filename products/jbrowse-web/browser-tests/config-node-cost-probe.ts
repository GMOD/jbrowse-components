/* eslint-disable no-console */
// What creating track config nodes costs in a production build, where
// `configSchemaCost.test.ts` answers under jest with MST's type check on.
//
//   pnpm --filter @jbrowse/web build
//   PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome \
//     node products/jbrowse-web/browser-tests/config-node-cost-probe.ts
//
// Rewrites the rows of agent-docs/measurements/config-nodes-in-browser.json.
// Each ms is the minimum of fifteen runs after one warm-up, each after a forced
// GC, in the page, through the app's own track config union.
import fs from 'node:fs'
import path from 'node:path'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { startServerOnFreePort } from './server.ts'

const COUNTS = [262, 2620]

const { server, port } = await startServerOnFreePort(3000)
const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--js-flags=--expose-gc'],
})

try {
  const page = await browser.newPage()
  await page.goto(
    `http://localhost:${port}/?config=test_data/volvox/config.json`,
    { waitUntil: 'networkidle0', timeout: 120_000 },
  )
  await page.waitForFunction('window.jb?.rootModel', { timeout: 60_000 })
  const rows = (await page.evaluate(`(() => {
    const { mst } = window.jb
    const pm = mst.getEnv(window.jb.rootModel).pluginManager
    const trackType = pm.pluggableConfigSchemaType('track')
    const snapshots = n =>
      Array.from({ length: n }, (_, i) => ({
        type: 'FeatureTrack',
        trackId: 't' + i,
        name: 'Track ' + i,
        assemblyNames: ['volvox'],
        adapter: {
          type: 'BedTabixAdapter',
          bedGzLocation: { uri: 't' + i + '.bed.gz', locationType: 'UriLocation' },
          index: {
            location: { uri: 't' + i + '.bed.gz.tbi', locationType: 'UriLocation' },
          },
        },
      }))
    return ${JSON.stringify(COUNTS)}.map(tracks => {
      const runs = []
      for (let i = 0; i < 16; i++) {
        const input = snapshots(tracks)
        globalThis.gc?.()
        const start = performance.now()
        mst.types.array(trackType).create(input)
        runs.push(performance.now() - start)
      }
      return { tracks, ms: +Math.min(...runs.slice(1)).toFixed(1) }
    })
  })()`)) as { tracks: number; ms: number }[]

  const record = path.resolve(
    'agent-docs/measurements/config-nodes-in-browser.json',
  )
  const existing = JSON.parse(fs.readFileSync(record, 'utf8'))
  existing.measured = new Date().toISOString().slice(0, 10)
  existing.rows = rows.map(values => ({ values }))
  fs.writeFileSync(record, `${JSON.stringify(existing, null, 2)}\n`)
  for (const { tracks, ms } of rows) {
    console.log(`${tracks} track config nodes: ${ms} ms`)
  }
} finally {
  await browser.close()
  server.close()
}
