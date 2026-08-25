// Three overlapping multi-isoform genes in real human annotation — the shape
// the isoform lane division exists for, and the one volvox cannot show. Its
// gene track has exactly one multi-isoform gene (EDEN) beside ~28 backdrop
// features, so it is never more than one GENE deep and the divisor is always 1.
//
//   node browser-tests/probe-stacked-gene-labels.ts
//
// chr19:5,674,000-5,692,000 in Gencode v36 holds RPL36 (8 transcripts),
// HSD11B1L (23) and MICOS13 (6), mutually overlapping. Undivided, each is sized
// to the WHOLE track height, the stack runs ~3x the lane at every height, and
// the fit ladder answers by descending to `bodies` where every name is hidden —
// so growing the track buys transcripts and never the label rows. Divided, each
// gets a third and the names survive.
//
// Reads the hosted Gencode/hg38 config, so this needs network. It is a probe,
// run by hand; nothing in CI depends on it.
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import {
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

// GENCODE carries no `Name=` attribute — only `gene_name=` — so JBrowse labels
// these by ID. Matching the symbol finds nothing and reads as "no labels drawn",
// which is a confident wrong answer, not an error.
const GENES = [
  'ENSG00000130255.13', // RPL36, 8 transcripts
  'ENSG00000167733.14', // HSD11B1L, 23
  'ENSG00000174917.9', // MICOS13, 6
  'ENSG00000196365.12', // LONP1
]

const { port, server } = await startServerOnFreePort(3564)
setPort(port)
const browser = await launch({
  headless: true,
  args: BASE_CHROME_ARGS,
  defaultViewport: { width: 1280, height: 800 },
})
const page = await browser.newPage()

async function probe(height: number) {
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr19:5,674,000..5,692,000',
          tracks: [
            {
              trackId: 'gencode.v36.annotation.sort.gff3',
              heightMode: 'fit',
              height,
            },
          ],
        },
      ],
    },
    'test_data/config_demo.json',
  )
  await waitForDataLoaded(page, 120000)
  await new Promise(r => setTimeout(r, 2500))
  return page.evaluate(names => {
    const root = document.querySelector('[data-testid="feature-display"]')
    const d = (window as any).JBrowseSession?.views?.[0]?.tracks?.[0]
      ?.displays?.[0]
    const labels = root
      ? [...root.querySelectorAll('div')]
          .filter(el => el.childElementCount === 0 && !!el.textContent.trim())
          .map(el => el.textContent.trim())
      : []
    return {
      height: d?.height,
      maxIsoforms: d?.fitStage?.maxIsoforms,
      fitLevel: d?.fitStage?.level,
      total: labels.length,
      names: names.filter(n => labels.includes(n)),
      sample: labels.slice(0, 12),
      featureCount: [...(d?.rpcDataMap?.values() ?? [])].reduce(
        (a: number, r: any) => a + (r?.featureCount ?? 0),
        0,
      ),
      loc: (window as any).JBrowseSession?.views?.[0]?.coarseDynamicBlocks?.[0]
        ?.refName,
      rootFound: !!root,
    }
  }, GENES)
}

try {
  console.log(
    'height'.padStart(7),
    'isoforms'.padStart(9),
    'fitLevel'.padStart(10),
    'labels'.padStart(7),
    '  genes named',
  )
  for (const height of [150, 250, 400, 600, 900]) {
    const r = await probe(height)
    console.log(
      String(r.height).padStart(7),
      String(r.maxIsoforms).padStart(9),
      String(r.fitLevel).padStart(10),
      String(r.total).padStart(7),
      `${r.names.length}/${GENES.length} named`,
    )
    console.log('         badges=', JSON.stringify(r.sample))
  }
} finally {
  await browser.close()
  server.close()
}
