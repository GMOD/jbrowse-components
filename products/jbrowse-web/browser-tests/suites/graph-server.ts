// End-to-end tests for the graph-server architecture: a sidecar Express
// process that runs odgi locally, replacing the static-file GfaTabixAdapter
// with a runtime backend. The new GfaServerAdapter (plugins/comparative-
// adapters) talks to the server over HTTP. Both consumers are exercised:
//
//   (1) MultiLGVSyntenyDisplay — renders synteny blocks from the server's
//       /datasets/:id/synteny endpoint (odgi extract → path-pair walk).
//   (2) GraphGenomeView — opened from the track menu, loads GFA from the
//       server's /datasets/:id/subgraph endpoint (odgi extract).
//
// The graph-server is spawned per-test so each test gets a clean process and
// failures don't poison subsequent runs. Server logs are forwarded with a
// `[graph-server]` prefix so timing/perf info shows up in the test output.

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'
import type { ChildProcess, ChildProcessByStdio } from 'child_process'
import type { Page } from 'puppeteer'
import type { Readable } from 'stream'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '../../../..')
const SERVER_ENTRY = path.join(REPO, 'tools/graph-server/src/server.ts')
const VOLVOX_DATASETS = path.join(
  REPO,
  'tools/graph-server/test/datasets.volvox.json',
)
const config = 'test_data/config_graph_server.json'
const GRAPH_SERVER_PORT = 5099

interface GraphServerHandle {
  proc: ChildProcess
  shutdown: () => Promise<void>
}

async function startGraphServer(): Promise<GraphServerHandle> {
  const proc: ChildProcessByStdio<null, Readable, Readable> = spawn(
    'node',
    ['--experimental-strip-types', SERVER_ENTRY],
    {
      cwd: REPO,
      env: {
        ...process.env,
        PORT: String(GRAPH_SERVER_PORT),
        GRAPH_SERVER_DATASETS: VOLVOX_DATASETS,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  proc.stdout.on('data', d => {
    process.stdout.write(`[graph-server] ${d}`)
  })
  proc.stderr.on('data', d => {
    process.stderr.write(`[graph-server-err] ${d}`)
  })

  const base = `http://127.0.0.1:${GRAPH_SERVER_PORT}/api/v0/health`
  let ready = false
  for (let i = 0; i < 100; i++) {
    await delay(150)
    try {
      const r = await fetch(base)
      if (r.ok) {
        ready = true
        break
      }
    } catch {
      // not ready
    }
  }
  if (!ready) {
    proc.kill('SIGKILL')
    throw new Error(
      `graph-server did not respond on port ${GRAPH_SERVER_PORT} within 15s`,
    )
  }
  return {
    proc,
    shutdown: () =>
      new Promise<void>(resolve => {
        proc.once('exit', () => {
          resolve()
        })
        proc.kill()
      }),
  }
}

async function withGraphServer<T>(fn: () => Promise<T>): Promise<T> {
  const handle = await startGraphServer()
  try {
    return await fn()
  } finally {
    await handle.shutdown()
  }
}

async function openMultiLgvServer(page: Page, loc = 'ctgA:1-50001') {
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'ref#0',
          loc,
          tracks: [
            {
              trackId: 'volvox_pangenome_server',
              // Boost height so all 51 sample rows are individually visible.
              // Default canvas is ~100 px; 51 rows ÷ 55 px (after coverage)
              // ≈ 1 px each → unreadable. MultiLGVSyntenyDisplay composes
              // TrackHeightMixin directly (not BaseLinearDisplay), so it
              // doesn't get the height→heightPreConfig snapshot rewrite —
              // use heightPreConfig explicitly here.
              displaySnapshot: {
                type: 'MultiLGVSyntenyDisplay',
                heightPreConfig: 600,
              },
            },
          ],
        },
      ],
    },
    config,
  )
  await findByTestId(page, 'multi_synteny_canvas_done', 60000)
  await waitForDataLoaded(page)
}

async function waitForGraphRendered(page: Page, timeout = 30000) {
  // GraphGenomeView toolbar shows "<N> nodes" once layout completes.
  await page.waitForFunction(
    () => {
      const body = document.body.textContent || ''
      const hasNodes = /\b\d+\s+nodes\b/.test(body)
      const isLoading =
        body.includes('Computing layout') ||
        body.includes('Downloading') ||
        body.includes('Fetching subgraph')
      return hasNodes && !isLoading
    },
    { timeout, polling: 500 },
  )
}

const suite: TestSuite = {
  name: 'GfaServerAdapter (express + odgi backend)',
  // Requires an installed odgi binary (defaults to ~/src/vendor/odgi/bin/odgi
  // or $ODGI). Gated behind --include-remote so CI without odgi is unaffected.
  requiresRemote: true,
  tests: [
    {
      name: 'MultiLGVSyntenyDisplay renders synteny from graph-server',
      fn: async page =>
        withGraphServer(async () => {
          const errors: string[] = []
          page.on('console', msg => {
            if (msg.type() === 'error') {
              errors.push(msg.text())
            }
          })
          await openMultiLgvServer(page, 'ctgA:1-50001')
          await delay(800)
          await canvasSnapshot(
            page,
            'graph-server-multilgv-canvas',
            '[data-testid="multi_synteny_canvas_done"]',
            0.2,
          )
          await pageSnapshot(page, 'graph-server-multilgv-page', 0.2)
          const relevant = errors.filter(
            e =>
              e.toLowerCase().includes('gfaserver') ||
              e.toLowerCase().includes('multipair') ||
              e.toLowerCase().includes('failed to fetch'),
          )
          if (relevant.length > 0) {
            throw new Error(
              `Console errors during synteny render: ${relevant.join('; ')}`,
            )
          }
        }),
    },
    {
      name: 'launch GraphGenomeView from MultiLGVSyntenyDisplay track menu',
      fn: async page =>
        withGraphServer(async () => {
          // Region focused on a documented 2946 bp SV bubble (volvox
          // bubbles.bed at ref#0#ctgA:11536-14482) so the bandage layout
          // shows a clear loop instead of a uniform curve.
          await openMultiLgvServer(page, 'ctgA:11000-15000')

          const trackMenu = await findByTestId(page, 'track_menu_icon', 10000)
          await trackMenu?.click()
          await delay(300)

          const launchItem = await findByText(page, /Launch/i, 10000)
          await launchItem?.click()
          await delay(300)

          const graphItem = await findByText(
            page,
            /Graph genome view \(local\)/i,
            10000,
          )
          await graphItem?.click()

          await waitForGraphRendered(page)
          await delay(1500)
          await canvasSnapshot(
            page,
            'graph-server-graph-launched-canvas',
            '[data-testid="graph-genome-canvas"]',
            0.2,
          )
          await pageSnapshot(page, 'graph-server-graph-launched-page', 0.2)
        }),
    },
  ],
}

export default suite
