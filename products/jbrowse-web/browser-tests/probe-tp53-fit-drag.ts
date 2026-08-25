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
// shows its names and then loses them a moment later. That WAS a transient
// between two settled states — the isoform budget was debounced 300ms behind
// the height, so the frames right after a resize were laid out against the old
// one and the refetch that followed replaced them. ADR-092 moved the trim onto
// the fit ladder, so a drag re-solves in the frame rather than refetching, and
// the rows below should read the same from +80ms on. A row that does not is the
// regression this probe is for.
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
    maxIsoforms: d?.fitStage?.maxIsoforms,
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
  // what the model sees. Nothing about the track's size reaches the worker now,
  // so the count moves with the frame.
  await page.evaluate(DRAG_TO => {
    const d = (window as any).JBrowseSession?.views?.[0]?.tracks?.[0]
      ?.displays?.[0]
    d?.configuration?.setSlot?.('height', DRAG_TO)
  }, DRAG_TO)
  // The first two samples used to be laid out against the old budget at the new
  // height — the frame that looked best and could not last. They should now
  // match the rest.
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
