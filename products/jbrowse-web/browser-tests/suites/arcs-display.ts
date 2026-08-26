import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  delay,
  findByTestId,
  findByText,
  findDisplayPainted,
  navigateWithSessionSpec,
  waitForDataLoaded,
  waitForDisplayPaint,
  waitForElementCount,
} from '../helpers.ts'
import { dualSnapshot, pageSnapshot } from '../snapshot.ts'
import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestCase, TestSuite } from '../types.ts'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'
import type { Page } from 'puppeteer'

const pileup = 'pileup-display'

// The live model, as `window.JBrowseSession` exposes it. The two arc feeds are
// `Pick`ed off the real model rather than restated, so a rename is a compile
// error here instead of an assertion that silently reads `undefined`.
interface LiveModel {
  JBrowseSession: {
    views: {
      tracks: {
        displays: Pick<
          LinearAlignmentsDisplayModel,
          'arcsByGroup' | 'crossRegionArcsByGroup'
        >[]
      }[]
    }[]
  }
}

// What the arc band actually resolved to, counted three ways because the three
// answer different questions and a pixel diff answers none of them: how many
// paths the cross-region overlay put in the DOM, how many arcs the model put in
// its cross-region half, and how many interchromosomal TICKS survived. The last
// is what makes the single-region control mean something — "no cross-region
// arcs" is also true of a display that resolved nothing at all.
async function arcCounts(page: Page) {
  const model = await page.evaluate(() => {
    const { JBrowseSession } = window as unknown as LiveModel
    const display = JBrowseSession.views[0]!.tracks[0]!.displays[0]!
    let crossRegion = 0
    for (const arcs of display.crossRegionArcsByGroup.values()) {
      crossRegion += arcs.length
    }
    let ticks = 0
    for (const byRegion of display.arcsByGroup.values()) {
      for (const data of byRegion.values()) {
        ticks += data.numArcLines
      }
    }
    return { crossRegion, ticks }
  })
  const paths = await page.$$eval(
    '[data-testid="cross-region-arc"]',
    els => els.length,
  )
  return { ...model, paths }
}

// One region layout over `volvox_translocation`, snapshotted AND counted.
//
// The snapshot target is the display CONTAINER, not `${displayPainted(...)}
// canvas`, which is what a plain `lgvSnapshotTest` would take. The cross-region
// overlay is an SVG SIBLING of the canvas, so the default target holds not one
// arc of what this test is about — it would pass green over a picture with
// nothing in it. The BEDPE case in this file overrides the same field for its
// own reason.
function translocationArcsTest({
  name,
  snapshot,
  loc,
  expected,
}: {
  name: string
  snapshot: string
  loc: string
  expected: { paths: number; crossRegion: number; ticks: number }
}): TestCase {
  return {
    name,
    fn: async page => {
      await navigateWithSessionSpec(page, {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'volvox',
            loc,
            tracks: [
              {
                trackId: 'volvox_translocation',
                displaySnapshot: {
                  type: 'LinearAlignmentsDisplay',
                  readConnections: 'arc',
                },
              },
            ],
          },
        ],
      })
      await waitForDisplayPaint(page, `${displayPainted(pileup)} canvas`)
      await waitForDataLoaded(page)
      // Wait for the paths BEFORE counting them, or an expectation of zero and
      // an overlay that has not rendered yet are the same observation.
      if (expected.paths > 0) {
        await waitForElementCount(
          page,
          '[data-testid="cross-region-arc"]',
          expected.paths,
        )
      }
      const counts = await arcCounts(page)
      if (
        counts.paths !== expected.paths ||
        counts.crossRegion !== expected.crossRegion ||
        counts.ticks !== expected.ticks
      ) {
        throw new Error(
          `${loc}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(counts)}`,
        )
      }
      await dualSnapshot(page, `${snapshot}-canvas`, displayPainted(pileup))
    },
  }
}

const suite: TestSuite = {
  name: 'Arcs and BEDPE Displays',
  tests: [
    {
      name: 'arc track renders',
      fn: async page => {
        // arc_track uses LinearArcDisplay (SVG renderer) with features at
        // ctgA:180-290; navigate close enough to see arcs clearly
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:150-350',
              tracks: ['arc_track'],
            },
          ],
        })

        await findByText(page, 'ctgA')
        await findDisplayPainted(page, 'arc-display', 60000)
        await waitForDataLoaded(page)
        await pageSnapshot(page, 'arcs-arc-test')
      },
    },
    lgvSnapshotTest({
      name: 'read connections arcs (volvox_sv)',
      snapshot: 'arcs-read-connections',
      loc: 'ctgA:2,707..48,600',
      tracks: [
        {
          trackId: 'volvox_sv',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            readConnections: 'arc',
          },
        },
      ],
      displayTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'RNA-seq sashimi arcs (spliced alignments)',
      snapshot: 'arcs-rnaseq-sashimi',
      loc: 'ctgA:1-10000',
      tracks: ['spliced'],
      displayTestId: pileup,
    }),
    lgvSnapshotTest({
      // THE DEFAULT, and it sets nothing so that it stays the default:
      // `readConnectionsDown`'s `promotedBase` is true (configSchema.ts), so
      // arcs point DOWN — below the coverage band — unless a track says
      // otherwise. This case is what a user gets, and the one below is the
      // opt-out.
      name: 'cloud mode (paired-end SV)',
      snapshot: 'arcs-cloud',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox_sv_cram',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            readConnections: 'cloud',
          },
        },
      ],
      displayTestId: pileup,
    }),
    lgvSnapshotTest({
      // UP mode, the non-default, which is why it is the one spelling a value
      // out. Its predecessor set `readConnectionsDown: true` and so captured
      // the default over again: byte-identical goldens to the case above, on
      // all three backends. That was invisible from 5556f47257 (2026-07-12),
      // which flipped the ambient default to true months after this test was
      // written against a false one — and it left up mode with no coverage at
      // all. Up mode anchors the axis at the band's BOTTOM, which is where a
      // read cloud's parked marks sit.
      name: 'cloud up mode (arcs above the coverage band)',
      snapshot: 'arcs-cloud-up',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox_sv_cram',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            readConnections: 'cloud',
            readConnectionsDown: false,
          },
        },
      ],
      displayTestId: pileup,
    }),
    // The window `ARC_FAR_SCREEN_WIDTHS` governs, which no other case here is
    // inside: volvox_sv's widest pairs span ~32 kb, so at 20 kb they are 1.6
    // screen widths — wider than the view, and well under the 3 at which the
    // ellipse gives its segments up and the circle branch takes over.
    //
    // What it pins is that such a pair keeps its LEAN. A circle's tangent at
    // its foot is vertical whatever its radius, and the band shows only the
    // first `availH` px of the rise, so collapsing to one here drew the 19
    // pairs of that event as a bundle of verticals with no direction in them.
    // Every other arc case in this suite sits under one screen width, so the
    // threshold could move either way without moving a golden.
    lgvSnapshotTest({
      name: 'arc mode, pair wider than the view (keeps its lean)',
      snapshot: 'arcs-wider-than-view',
      loc: 'ctgA:1-20000',
      tracks: [
        {
          trackId: 'volvox_sv',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            readConnections: 'arc',
            // A TALL band, because the difference this pins is vertical. At the
            // default height the whole band is a few px and a leaning arc and a
            // vertical leg differ by 0.71% of the capture — under the 5% gate,
            // so the golden passed with the threshold reverted and pinned
            // nothing. Measured, not guessed: that is what the first version of
            // this case did.
            readConnectionsHeight: 160,
          },
        },
      ],
      displayTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'BEDPE arcs (LinearPairedArcDisplay)',
      snapshot: 'arcs-bedpe',
      // volvox_bedpe has arcs from ctgA:2700→34200 and cross-contig A↔B arcs
      loc: 'ctgA:1-50000',
      tracks: ['volvox_bedpe'],
      displayTestId: 'arc-display',
      // the arc display's `*-done` element IS the canvas, not a parent of one
      snapshotSelector: displayPainted('arc-display'),
    }),
    lgvSnapshotTest({
      name: 'paired-end stranded RNA-seq',
      snapshot: 'arcs-paired-end-rnaseq',
      loc: 'ctgA:1-10000',
      tracks: ['paired_end_stranded_rnaseq'],
      displayTestId: pileup,
    }),

    // The same data and the same track at three region layouts, differing only
    // in how many regions are displayed. That is the point: an arc joining two
    // displayed regions is a claim about the LAYOUT, so no one of these three
    // says anything on its own.
    //
    // `volvox-translocation.bam` is built for exactly this (see
    // test_data/volvox/README.md): 6 split-read molecules at one coordinate,
    // 8 mate pairs over the same breakpoint, 3 decoy pairs reaching a part of
    // ctgB no window shows, and 5 same-chromosome long-range pairs.
    translocationArcsTest({
      name: 'interchromosomal arcs (both feet displayed)',
      snapshot: 'arcs-interchrom-two-contigs',
      loc: 'ctgA:19,000-21,000 ctgB:2,500-3,500',
      // 1 + 8: the six split molecules COALESCE to one thick arc, which is the
      // whole value of drawing this as an arc rather than as ticks, and the
      // eight mate pairs each keep their own coordinate, which is the whole
      // reason `arcKey` refuses to invent a merged position for them.
      //
      // The 3 ticks are the decoy, whose far foot is on a part of ctgB no
      // window shows — so this frame carries an arc AND a tick, and both
      // counts stay honest.
      expected: { paths: 9, crossRegion: 9, ticks: 3 },
    }),
    translocationArcsTest({
      name: 'cross-region arcs on one chromosome (two ctgA windows)',
      snapshot: 'arcs-cross-region-two-windows',
      loc: 'ctgA:19,000-21,000 ctgA:29,000-31,000',
      // The five long-range pairs, and NOTHING interchromosomal: with ctgB off
      // screen every connection reaching it is a tick again — 1 coalesced
      // split-read tick, 8 mate ticks, 3 decoy ticks. Same reads as above.
      expected: { paths: 5, crossRegion: 5, ticks: 12 },
    }),
    translocationArcsTest({
      name: 'control: one region, so nothing crosses one',
      snapshot: 'arcs-cross-region-control',
      loc: 'ctgA:19,000-21,000',
      // The control the other two need. Without it both are equally satisfied
      // by an overlay that draws unconditionally — and the tick count is what
      // separates "the overlay correctly drew nothing" from "the arc band
      // resolved nothing at all".
      expected: { paths: 0, crossRegion: 0, ticks: 12 },
    }),
    {
      name: 'collapse introns view with RNA-seq sashimi arcs (EDEN gene)',
      fn: async page => {
        // EDEN gene is at ctgA:1050-9000 with 3 isoforms (CDS blocks at
        // ~1200, ~3000, ~5000, ~7000). The spliced RNA-seq BAM has reads
        // covering this region with N-CIGAR operations that produce sashimi
        // arcs.
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1050-9000',
              tracks: ['gff3tabix_genes', 'spliced'],
            },
          ],
        })

        await findByTestId(page, pileup, 60000)
        await waitForDataLoaded(page)

        // Wait for the EDEN gene label overlay to appear — this confirms the
        // gene annotation canvas has finished drawing
        const edenLabel = await page.waitForSelector(
          '[data-testid="feature-name-EDEN"]',
          { timeout: 30000 },
        )
        if (!edenLabel) {
          throw new Error('EDEN gene label not found')
        }

        // Right-click the label to trigger the feature context menu
        await edenLabel.click({ button: 'right' })
        await delay(500)

        const collapseItem = await findByText(page, /Collapse introns/, 10000)
        await collapseItem.click()
        await delay(300)

        // CollapseIntronsDialog offers "Replace current view" (collapse in
        // place) or "Open in new view" (add a second LGV). We want the latter
        // so the snapshot shows both the original and the collapsed view.
        // Match the button, not a bare text node, so the click can't resolve to
        // dialog prose that repeats the button's wording.
        const openInNewView = await page.waitForSelector(
          'button::-p-text(Open in new view)',
          { timeout: 10000 },
        )
        if (!openInNewView) {
          throw new Error(
            '"Open in new view" not found in collapse introns dialog',
          )
        }
        await openInNewView.click()

        // The new LGV has displayedRegions set to the EDEN exon blocks; wait
        // for its pileup canvas to finish drawing
        await waitForElementCount(page, displayPainted('pileup-display'), 2)
        await waitForDataLoaded(page)

        // Full-page snapshot shows both views: original + collapsed exon view
        // with sashimi arcs spanning the compressed intron gaps
        await pageSnapshot(page, 'arcs-collapse-introns-sashimi')
      },
    },
  ],
}

export default suite
