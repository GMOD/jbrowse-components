#!/usr/bin/env node
/**
 * probe-synteny-features.ts — dump the alignments a LinearSyntenyView spec draws.
 *
 *   node scripts/probe-synteny-features.ts pangenome/hprc_inversion
 *
 * Which records land in a synteny figure is a property of the data plus both
 * views' regions, so a spec that says "this row runs straight through" is a
 * claim about the drawn set. This prints it per level, from the display's own
 * `featureData`, which is what the renderer uploaded.
 */
import { parseArgs } from 'node:util'

import {
  resolveUrlSpec,
  specUrl,
  specViewport,
  withHarness,
} from './dev-harness.ts'

const PORT = 3347

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { view: { type: 'string' }, settle: { type: 'string' } },
})
const specName = positionals[0]
const viewIndex = Number(values.view ?? 0)
const settle = Number(values.settle ?? 12000)

const spec = resolveUrlSpec(
  positionals[0],
  `no url-mode spec named "${specName}"`,
)

const dump = await withHarness(
  { port: PORT, protocolTimeout: 1200000, viewport: specViewport(spec) },
  async ({ page }) => {
    await page.goto(specUrl(spec, PORT), {
      waitUntil: 'domcontentloaded',
      timeout: 300000,
    })
    await page.waitForSelector('[data-testid="synteny_canvas_done"]', {
      timeout: 300000,
    })
    await new Promise(r => setTimeout(r, settle))

    return page.evaluate(index => {
      interface Data {
        strands: Int8Array
        starts: Uint32Array
        ends: Uint32Array
        refNames: string[]
        mateStarts: Uint32Array
        mateEnds: Uint32Array
        mateRefNames: string[]
      }
      interface Display {
        type: string
        featureData?: Data
      }
      interface Level {
        tracks?: { displays?: Display[] }[]
      }
      interface View {
        views?: (View & {
          levels?: Level[]
          displayedRegions?: { refName: string; start: number; end: number }[]
        })[]
        levels?: Level[]
      }
      const view = (window as unknown as { JBrowseSession?: View })
        .JBrowseSession?.views?.[index]
      return {
        rows: (view?.views ?? []).map(v => ({
          regions: (v.displayedRegions ?? []).map(
            r => `${r.refName}:${r.start}-${r.end}`,
          ),
        })),
        levels: (view?.levels ?? []).map(level =>
          (level.tracks ?? []).flatMap(t =>
            (t.displays ?? []).map(d => {
              const f = d.featureData
              return {
                display: d.type,
                features: f
                  ? [...f.starts].map((s, i) => ({
                      strand: f.strands[i],
                      ref: `${f.refNames[i]}:${s}-${f.ends[i]}`,
                      mate: `${f.mateRefNames[i]}:${f.mateStarts[i]}-${f.mateEnds[i]}`,
                    }))
                  : undefined,
              }
            }),
          ),
        ),
      }
    }, viewIndex)
  },
)

console.log(JSON.stringify(dump, null, 2))
