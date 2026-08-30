import { act, waitFor } from '@testing-library/react'

import { censusRenders } from './renderCensus.ts'
import {
  createView,
  doBeforeEach,
  findDisplayPainted,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

const FRAMES = 20
const STEP = 1.15

beforeEach(() => {
  doBeforeEach()
})

async function census({
  trackIds,
  startBpPerPx,
  offsetPx = 0,
  painted,
  label,
}: {
  trackIds: string[]
  startBpPerPx: number
  offsetPx?: number
  painted: string
  label: string
}) {
  const { view, container } = await createView(volvoxConfigWithTracks(trackIds))
  view.setNewView(startBpPerPx, offsetPx)
  for (const trackId of trackIds) {
    view.showTrack(trackId)
  }
  await waitFor(
    () => {
      expect(view.tracks.length).toBe(trackIds.length)
    },
    { timeout: 30000 },
  )
  await findDisplayPainted(painted, { timeout: 30000 })

  const where = (n: Node | null): string => {
    let el = (n instanceof Element ? n : n?.parentElement) ?? null
    const trail: string[] = []
    while (el) {
      const id = (el as HTMLElement).dataset.testid
      if (id) {
        return `${id} > ${trail.slice(0, 2).reverse().join('/')}`
      }
      const cls =
        typeof el.className === 'string' ? el.className.split(' ')[0] : ''
      if (cls) {
        trail.push(cls)
      }
      el = el.parentElement
    }
    return trail.slice(-3).reverse().join('/') || '<root>'
  }

  const mutations: string[] = []
  const mo = new MutationObserver(records => {
    for (const r of records) {
      const kind =
        r.type === 'attributes'
          ? `attr:${r.attributeName}`
          : `${r.type}:+${r.addedNodes.length}/-${r.removedNodes.length}`
      mutations.push(`${kind}  @  ${where(r.target)}`)
    }
  })
  mo.observe(container, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  })

  const c = censusRenders()
  try {
    c.reset()
    for (let i = 0; i < FRAMES; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        view.zoomTo(view.bpPerPx * STEP)
      })
    }
    const structural = mutations.filter(m => m.startsWith('childList')).length
    const tally = new Map<string, number>()
    for (const m of mutations) {
      tally.set(m, (tally.get(m) ?? 0) + 1)
    }
    const per = (n: number) => (n / FRAMES).toFixed(1)
    const head =
      `${label}: ${view.tracks.length} tracks, ` +
      `${startBpPerPx}->${view.bpPerPx.toFixed(0)} bp/px, ${FRAMES} frames — ` +
      `${per(c.total())} renders/frame, ${per(mutations.length)} DOM ` +
      `mutations/frame (${per(structural)} structural)`

    // The tables are the instrument and the one-liner is the CI signal, because
    // this file runs in every full suite and four ranked dumps there are noise.
    // Anyone reading the summary and wanting to know WHICH component moved
    // needs the flag named in it.
    if (process.env.ZOOM_CENSUS) {
      const churn = [...tally]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([k, n]) => `${String(n).padStart(6)}  ${k}`)
        .join('\n')
      // eslint-disable-next-line no-console
      console.log(
        `\n=== ${head} ===\n\n${c.report(25)}\n\nwhere the DOM churn lands:\n${churn}`,
      )
    } else {
      // eslint-disable-next-line no-console
      console.log(`${head}  [ZOOM_CENSUS=1 for the per-component tables]`)
    }
    return {
      counts: c.components(),
      // How many DOM mutations the tally attributed to these testids. The
      // component count cannot answer for a display that draws to a canvas —
      // it renders once a frame either way — so an arm asserting that a display
      // stopped churning the DOM needs the other half of the instrument.
      //
      // A LIST, because `where` attributes each mutation to its NEAREST
      // testid: a display's own subtree is split across every testid inside it,
      // and asking about the outermost one alone would miss exactly the churn
      // an inner wrapper is hiding.
      mutationsUnder: (testids: string[]) =>
        mutations.filter(m => testids.some(id => m.includes(`@  ${id} `)))
          .length,
    }
  } finally {
    c.stop()
    mo.disconnect()
  }
}

// The regime the browser harness sweeps (0.5-4 bp/px), plus a track of each
// family so the count reflects the chrome each one mounts.
test('census: mixed tracks, base-ish zoom', async () => {
  const { counts } = await census({
    label: 'mixed',
    trackIds: [
      'volvox_microarray',
      'volvox_microarray_multi',
      'volvox_filtered_vcf',
      'volvox_gc',
    ],
    startBpPerPx: 5,
    painted: 'wiggle-display',
  })

  // Two of this file's three expectations; the mid-contig arm below carries the
  // third, and the rest of the census is a readout.
  // A wiggle body has nothing per-frame to say during a zoom: the plot is
  // painted onto a canvas by the render autorun, and every observable the body
  // itself reads — plot geometry, ticks, domain, score rules — is settled or
  // debounced. It re-rendered once per frame anyway, because it derived its
  // legend's right edge from `visibleRegions`, an array the view rebuilds every
  // frame; the view now publishes `contentRightEdgePx` as a scalar. Restoring
  // the array read takes these back over one per frame, which is the sabotage
  // this number is chosen to catch. The counting window opens after first
  // paint, so the mount is not in it; the headroom is for the refetch rounds a
  // gesture legitimately triggers, which are the nondeterministic part.
  const perGesture = (name: string) => counts.get(name) ?? 0
  expect(perGesture('WiggleBody')).toBeLessThan(FRAMES)
  expect(perGesture('MultiWiggleBody')).toBeLessThan(FRAMES)
}, 90000)

// The same gesture at twice the track count. Every per-frame cost this file
// ranks is either view-global (the scalebar and ruler chrome) or paid once per
// track (the padding-block and gridline overlays, each display's own body), and
// which of the two a component is is the whole of whether it matters in a real
// session.
test('census: mixed tracks at 8, base-ish zoom', async () => {
  await census({
    label: 'mixed x8',
    trackIds: [
      'volvox_microarray',
      'volvox_microarray_multi',
      'volvox_filtered_vcf',
      'volvox_gc',
      'volvox_microarray_line',
      'volvox_microarray_density',
      'volvox_test_vcf',
      'volvox_microarray_color',
    ],
    startBpPerPx: 5,
    painted: 'wiggle-display',
  })
}, 120000)

// Zooming INSIDE one contig, which is where a reader spends nearly all of a
// session and where the arms above do not go: they start at offset 0 against a
// 50kb contig, so a boundary block is on screen throughout. Mid-contig there is
// no seam, no elision and no boundary — `paddingSpans` is empty, and every
// padding overlay in the view should be absent from the frame rather than
// positioning nothing.
test('census: mid-contig, no padding spans to draw', async () => {
  const { counts } = await census({
    label: 'mid-contig',
    trackIds: [
      'volvox_microarray',
      'volvox_microarray_multi',
      'volvox_filtered_vcf',
      'volvox_gc',
    ],
    startBpPerPx: 1,
    offsetPx: 20000,
    painted: 'wiggle-display',
  })
  expect(counts.get('PaddingBlocks') ?? 0).toBe(0)
}, 90000)

// The regime INTERACTION_PERF flags as unmeasured: where people read gene
// tracks, and where FloatingLabelsLayer rebuilds a label div per feature.
test('census: gene track, label zoom', async () => {
  await census({
    label: 'genes',
    trackIds: ['gff3tabix_genes'],
    startBpPerPx: 10,
    painted: 'feature-display',
  })
}, 90000)

// An alignments track over DNA, which is where `showSashimiArcs` being promoted
// on costs something for nothing: every alignments track evaluates the sashimi
// pipeline now, and reads with no skip gap give it nothing to draw.
//
// `SashimiArcsOverlay` re-rendered on every frame of every gesture here,
// because `sashimiArcSections` rebuilt a fresh list of empty sections each time
// `view.visibleRegions` did. Zero is the whole band of headroom this one gets:
// with no junction in the file there is no frame on which the overlay has
// anything to say, and the counting window opens after first paint so the mount
// is not in it. `sashimiFrameSplit.test.ts` is the same statement one layer
// down, where it can also count the merge.
test('census: alignments over DNA, no junctions to draw', async () => {
  const { counts } = await census({
    label: 'alignments',
    trackIds: ['volvox_alignments_pileup_coverage'],
    startBpPerPx: 5,
    painted: 'pileup-display',
  })
  expect(counts.get('SashimiArcsOverlay') ?? 0).toBe(0)
}, 90000)

// Spliced reads, where the overlay DOES owe a frame — every arc's `d` is a
// function of the pan. What this arm is for is the per-arc DOM rate, which is
// the input to whether sashimi should leave SVG for the canvas/GPU arc stack:
// one `<path>` per arc gets one `attr:d` per frame, so `attr:d @ pileup-display`
// divided by the arc count is a rate that a bigger dataset multiplies. Volvox's
// junction counts are small (13 distinct in spliced.bam, 11 over the default
// score floor) — read the RATE here, not the total.
test('census: spliced alignments, sashimi arcs drawn', async () => {
  await census({
    label: 'spliced',
    trackIds: ['spliced'],
    startBpPerPx: 5,
    painted: 'pileup-display',
  })
}, 90000)

// The arc band, the one display family whose per-frame cost scaled with the
// FEATURE count rather than the track count: each arc was its own observer
// reading `bpToPx` and `offsetPx`, so four visible arcs booked 4 `Arc` + 4
// `ArcGlyph` reactions and 12 SVG attribute patches every frame.
test('census: arcs', async () => {
  const { counts, mutationsUnder } = await census({
    label: 'arcs',
    trackIds: ['arc_track', 'volvox_bedpe'],
    startBpPerPx: 1,
    painted: 'arc-display',
  })
  // The arcs are ink on a canvas, so a zoom moves pixels and not the DOM. This
  // was 240 over the same 20 frames — 160 `attr:x` on the two `<text>`s of each
  // arc's label and 80 `attr:d` on its `<path>`, 12 a frame for FOUR arcs and
  // growing with every one added.
  //
  // A small bound rather than 0: what is left is the chrome's own
  // `data-display-phase` / `data-display-drawn`, which flip when a refetch
  // round lands inside the 20 frames — a wall-clock race, and this arm has seen
  // both 0 and 2. Anything per-arc is two orders of magnitude above it.
  expect(mutationsUnder(['arc-display', 'arcs', 'arcs-canvas'])).toBeLessThan(
    10,
  )
  // ONE render per frame per display, whatever the arc count. `Arc` and
  // `ArcGlyph` — the per-feature observer and its wrapper — booked 4 apiece a
  // frame here and would book 2000 on a real SV callset.
  expect(counts.get('Arcs') ?? 0).toBeLessThanOrEqual(FRAMES * 2)
  expect(counts.has('Arc')).toBe(false)
}, 90000)
