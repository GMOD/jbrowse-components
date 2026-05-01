// Verifies the two end-to-end "open a subgraph" entry points described in
// the publication plan (agent-docs/GRAPH_PLAN.md):
//
//  (1) From a MultiLGVSyntenyDisplay backed by a GfaTabixAdapter, open the
//      track menu and pick "Graph genome view (local)" — the GetSubgraph RPC
//      runs against the adapter and a GraphGenomeView is added with the
//      returned GFA loaded.
//
//  (2) Add a fresh GraphGenomeView, switch the import form to Track mode,
//      pick the GfaTabix track, type a region and click Open — same RPC
//      path, different entry surface.
//
// Both flows depend on the same data path (Phase 0+1 audit-verified
// `getSubgraph` returning real sequences + edges + paths). These tests pin
// the *integration* — adapter config plumbing, RPC marshaling, view
// instantiation, and graph rendering — that the Jest unit tests can't
// cover.

import {
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const config = 'test_data/config_volvox_pangenome_50.json'

async function openMultiLgvWithPangenomeTrack(page: Page) {
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'ref#0',
          loc: 'ctgA:1-2000',
          tracks: [
            {
              trackId: 'volvox_pangenome_50_multi',
              displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
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
  // The GraphGenomeView shows "<N> nodes" in its toolbar once layout +
  // render complete (and is not in the "Computing layout" / "Downloading"
  // status). Same predicate the existing graph-genome.ts suite uses.
  await page.waitForFunction(
    () => {
      const body = document.body.textContent ?? ''
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
  name: 'Graph view launch from GfaTabixAdapter',
  tests: [
    {
      name: 'launch GraphGenomeView from MultiLGVSyntenyDisplay track menu',
      fn: async page => {
        await openMultiLgvWithPangenomeTrack(page)

        const trackMenu = await findByTestId(page, 'track_menu_icon', 10000)
        await trackMenu?.click()
        await delay(300)

        // Top-level entry that opens the launch sub-menu (varies by
        // build/locale; "Launch" is the canonical English label used by
        // SUBGRAPH_VIEW_TYPES in MultiLGVSyntenyDisplay/model.ts).
        const launchItem = await findByText(page, /Launch/i, 10000)
        await launchItem?.click()
        await delay(300)

        const graphItem = await findByText(page, /Graph genome view \(local\)/i, 10000)
        await graphItem?.click()

        await waitForGraphRendered(page)
        await delay(1000)
        await canvasSnapshot(
          page,
          'graph-launched-from-multilgv-canvas',
          'canvas',
          0.2,
        )
      },
    },
    {
      name: 'launch GraphGenomeView via import-form Track mode',
      fn: async page => {
        await openMultiLgvWithPangenomeTrack(page)

        // Add → Graph genome view
        await (await findByText(page, 'Add'))?.click()
        await delay(300)
        await (await findByText(page, 'Graph genome view'))?.click()
        await delay(500)

        // The import form opens in Track mode by default.
        await findByText(page, 'Load a GFA graph', 10000)

        // Pick the GFA track using the reliable MUI select trigger selector.
        const trackSelectTrigger = await page.waitForSelector(
          '[data-testid="gfa-track-field"] .MuiSelect-select',
          { timeout: 10000 },
        )
        await trackSelectTrigger?.click()
        await delay(400)
        const trackOption = await page.waitForSelector('[role="option"]', {
          timeout: 5000,
        })
        await trackOption?.click()
        await delay(300)

        // Type a region into the RefNameAutocomplete.
        const locInput = await page.waitForSelector(
          '[data-testid="gfa-loc-field"] input',
          { timeout: 5000 },
        )
        await locInput?.click()
        await locInput?.type('ctgA:1-1000', { delay: 40 })
        await locInput?.press('Escape')
        await delay(300)

        const openBtn = await page.waitForSelector(
          '[data-testid="gfa-open-btn"]',
          { timeout: 5000 },
        )
        await openBtn?.click()

        await waitForGraphRendered(page)
        await delay(1000)
        await canvasSnapshot(
          page,
          'graph-launched-from-import-form-canvas',
          'canvas',
          0.2,
        )
      },
    },
    {
      name: 'no console errors during graph subgraph launch',
      fn: async page => {
        const errors: string[] = []
        page.on('console', msg => {
          if (msg.type() === 'error') {
            errors.push(msg.text())
          }
        })

        await openMultiLgvWithPangenomeTrack(page)

        const trackMenu = await findByTestId(page, 'track_menu_icon', 10000)
        await trackMenu?.click()
        await delay(300)
        await (await findByText(page, /Launch/i, 10000))?.click()
        await delay(300)
        await (await findByText(page, /Graph genome view \(local\)/i, 10000))?.click()

        await waitForGraphRendered(page)
        await delay(500)

        // Filter to errors that would indicate the subgraph data path is
        // broken — we don't care about unrelated noise (e.g. analytics).
        const relevant = errors.filter(
          e =>
            e.toLowerCase().includes('getsubgraph') ||
            e.toLowerCase().includes('failed to fetch') ||
            e.toLowerCase().includes('adapter does not implement') ||
            e.toLowerCase().includes('rpcmanager'),
        )
        if (relevant.length > 0) {
          throw new Error(
            `Console errors during subgraph launch: ${relevant.join('; ')}`,
          )
        }
      },
    },
  ],
}

export default suite
