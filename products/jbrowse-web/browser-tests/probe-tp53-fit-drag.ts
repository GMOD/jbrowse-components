// The case that started this: the `WithTrackSizing` example in
// jbrowse-react-linear-genome-view, switched from `grow` to `fit` and dragged
// up and down.
//
//   node browser-tests/probe-tp53-fit-drag.ts
//
// hg19 NCBI RefSeq at chr17:7,560,000-7,600,000. TP53 carries 26 transcripts
// and OVERLAPS WRAP53 (4) head to head by ~1.4kb, so the lane is two
// multi-isoform genes deep.
//
// Samples the DRAG, not a set of heights. The complaint was that a taller track
// shows its names and then loses them a moment later, and that is a transient
// between two settled states: `coarseTrackHeight` is debounced HEIGHT_SETTLE_MS
// (300ms), so the frames right after a resize are laid out against the OLD
// isoform budget, and the refetch that follows replaces them. Navigating to a
// height and waiting cannot see it — every probe that does reports both frames
// as whichever one it happened to catch.
//
// Reads the hosted hg19 config, so it needs network; nothing in CI depends on
// it.
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import {
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

// NCBI RefSeq hg19 names features by symbol, unlike Gencode — see
// probe-stacked-gene-labels for the trap that caused.
const GENES = ['TP53', 'WRAP53', 'ATP1B2']

// A modest increase is the one that breaks: drag far enough and even the bigger
// budget fits, so the refetch lands on a stack that still has room.
const DRAG_TO = Number(process.env.DRAG_TO ?? 250)

const { port, server } = await startServerOnFreePort(3565)
setPort(port)
const browser = await launch({
  headless: true,
  args: BASE_CHROME_ARGS,
  defaultViewport: { width: 1280, height: 800 },
})
const page = await browser.newPage()

function readState(names: string[]) {
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
    maxIsoforms: d?.effectiveMaxIsoforms,
    fitLevel: d?.fitStage?.level,
    named: names.filter(n => labels.includes(n)).length,
    descriptions: d?.renderedShowDescriptions,
    subfeatureLabels: d?.renderedShowSubfeatureLabels,
    badges: labels.filter(t => t.endsWith('more')).length,
  }
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

try {
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr17:7,560,000..7,600,000',
          tracks: [
            { trackId: 'ncbi_gff_hg19', heightMode: 'fit', height: 150 },
          ],
        },
      ],
    },
    'test_data/config_demo.json',
  )
  await waitForDataLoaded(page, 120000)
  await delay(3000)

  console.log(
    'when'.padEnd(22),
    'height'.padStart(6),
    'isoforms'.padStart(9),
    'fitLevel'.padStart(10),
    'named'.padStart(6),
    'desc'.padStart(6),
    'badges'.padStart(7),
  )
  const row = (when: string, r: Awaited<ReturnType<typeof sample>>) => {
    console.log(
      when.padEnd(22),
      String(r.height).padStart(6),
      String(r.maxIsoforms).padStart(9),
      String(r.fitLevel).padStart(10),
      String(r.named).padStart(6),
      String(r.descriptions).padStart(6),
      String(r.badges).padStart(7),
    )
  }
  const sample = () => page.evaluate(readState, GENES)

  row('settled at 150', await sample())

  // The drag itself: the resize handle writes `height` every frame, so this is
  // what the model sees. `coarseTrackHeight` — and so `maxIsoforms`, and so the
  // fetch — does not move until 300ms after the last write.
  await page.evaluate(DRAG_TO => {
    const d = (window as any).JBrowseSession?.views?.[0]?.tracks?.[0]
      ?.displays?.[0]
    d?.configuration?.setSlot?.('height', DRAG_TO)
  }, DRAG_TO)
  // Straddling HEIGHT_SETTLE_MS (300ms): the first two samples are laid out
  // against the OLD budget at the NEW height, which is the frame that looks
  // best and cannot last; the rest are what the user is left with.
  let elapsed = 0
  for (const at of [80, 200, 400, 800, 1600, 3200]) {
    await delay(at - elapsed)
    elapsed = at
    row(`+${at}ms after drag`, await sample())
  }
} finally {
  await browser.close()
  server.close()
}
