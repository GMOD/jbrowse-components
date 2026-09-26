#!/usr/bin/env node
/**
 * probe-multiway-gutters.ts — what each gutter of a multi-way lane stack draws.
 *
 *   node scripts/probe-multiway-gutters.ts multiway_synteny/hprc_amylase_lanes
 *   node scripts/probe-multiway-gutters.ts <spec> --shot=/tmp/stack.png
 *   node scripts/probe-multiway-gutters.ts --url='?config=...&session=spec-...'
 *
 * A mismatch mark is a pixel or two wide and fades with its width, so a figure
 * cannot tell a gutter that drew no alignment detail from one whose detail is
 * too faint to see. This counts the instances in each gutter's uploaded
 * geometry by kind, and says whether the gutter's records were fetched for
 * that pair or composed through the anchor.
 */
import { parseArgs } from 'node:util'

import { displaySettled } from '@jbrowse/browser-test-utils'

import {
  awaitReadySelector,
  resolveUrlSpec,
  specUrl,
  specViewport,
  withHarness,
} from './dev-harness.ts'
import { trustCapturePlugins } from './screenshot-page.ts'

import type { SessionUrlSpec } from './screenshot-specs.ts'

const PORT = 3348

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: 'string' },
    shot: { type: 'string' },
    timeout: { type: 'string' },
    settle: { type: 'string' },
  },
})
const specName = positionals[0]
const timeout = Number(values.timeout ?? 300000)
const settle = Number(values.settle ?? 5000)

const spec: SessionUrlSpec = values.url
  ? {
      mode: 'url',
      name: 'probe',
      url: values.url,
      readySelector: displaySettled('multiway-synteny-display'),
    }
  : resolveUrlSpec(specName, `no url-mode spec named "${specName}"`)

const KIND_NAMES = ['ribbon', 'mismatch', 'marker', 'match', 'I', 'D', 'N']

const displays = await withHarness(
  { port: PORT, protocolTimeout: 1200000, viewport: specViewport(spec) },
  async ({ page }) => {
    await trustCapturePlugins(page)
    await page.goto(specUrl(spec, PORT), {
      waitUntil: 'domcontentloaded',
      timeout,
    })
    await awaitReadySelector(page, spec, timeout)
    await new Promise(r => setTimeout(r, settle))
    if (values.shot) {
      await page.screenshot({ path: values.shot })
    }
    return page.evaluate(kindCount => {
      interface Cell {
        kind: string
        data: { kinds: Uint8Array; instanceCount: number }
      }
      interface Display {
        type: string
        anchorAssemblyName: string
        rowAssemblies: string[]
        groups: unknown[]
        laneLinks?: Map<string, { links: unknown[] }>
        pairLinks: Map<string, { links: unknown[] }>
        ribbonGeometry: { cells: Map<string, Cell> }
      }
      interface Session {
        views: { tracks?: { displays: Display[] }[] }[]
      }
      const session = (window as unknown as { JBrowseSession: Session })
        .JBrowseSession
      return session.views.flatMap(view =>
        (view.tracks ?? [])
          .flatMap(t => t.displays)
          .filter(d => d.type === 'MultiWaySyntenyDisplay')
          .map(d => {
            const rows = [d.anchorAssemblyName, ...d.rowAssemblies]
            const gutters = [...d.ribbonGeometry.cells]
              .filter(([, cell]) => cell.kind === 'ribbons')
              .map(([key, cell]) => {
                const [from, to] = key
                  .slice('ribbons:'.length)
                  .split('>')
                  .map(Number)
                const upper = rows[from!]!
                const lower = rows[to ?? from! + 1]!
                const pair = `${upper}|${lower}`
                const source =
                  from === 0
                    ? 'anchor'
                    : (d.laneLinks?.get(pair)?.links.length ?? 0) > 0
                      ? 'fetched'
                      : d.pairLinks.has(pair)
                        ? 'composed'
                        : 'none'
                const counts = new Array<number>(kindCount).fill(0)
                const { kinds, instanceCount } = cell.data
                for (let i = 0; i < instanceCount; i++) {
                  counts[kinds[i]!]!++
                }
                return {
                  pair,
                  source,
                  records: d.pairLinks.get(pair)?.links.length,
                  counts,
                }
              })
            return {
              anchor: d.anchorAssemblyName,
              lanes: d.rowAssemblies,
              groups: d.groups.length,
              gutters,
            }
          }),
      )
    }, KIND_NAMES.length)
  },
)

for (const { anchor, lanes, groups, gutters } of displays) {
  console.log(`anchor ${anchor}, ${groups} groups, lanes ${lanes.join(' ')}`)
  console.log(
    [
      'gutter'.padEnd(44),
      'source'.padEnd(9),
      'records'.padStart(8),
      ...KIND_NAMES.map(k => k.padStart(9)),
    ].join(''),
  )
  for (const g of gutters) {
    console.log(
      [
        g.pair.padEnd(44),
        g.source.padEnd(9),
        String(g.records ?? '-').padStart(8),
        ...g.counts.map(c => String(c).padStart(9)),
      ].join(''),
    )
  }
}
if (displays.length === 0) {
  console.error('no MultiWaySyntenyDisplay on the page')
  process.exitCode = 1
}
