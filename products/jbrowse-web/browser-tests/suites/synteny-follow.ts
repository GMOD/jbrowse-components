import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  navigateWithSessionSpec,
  waitForDataLoaded,
  waitForDisplayPaint,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const grapePeachConfig = 'test_data/grape_peach_synteny/config.json'

// peach_grape_small.paf.gz: 1000 blocks, all local, none longer than ~3.6 kb.
// Whole-chromosome zoom over blocks that small is the ENVELOPE path — the
// window is inside no single alignment, so the placement comes from
// followWindowMapping rather than from a CIGAR walk, and that is the case the
// jsdom suite can assert the arithmetic of but not the result of.
//
// Over grape chr1 the answer is not a close call: Pp01 takes 34.2 kb of summed
// overlap against 6.9 kb for the runner-up (Pp04), so a regression that picks a
// neighbouring contig fails this rather than shifting a number slightly. Every
// chr1<->Pp01 block is on the minus strand, so this also covers the envelope's
// flip handling — a mishandled one yields a backwards span, which is why the
// width is asserted rather than just the contig.
//
// THE PEACH ROW SHOWS ITS WHOLE ASSEMBLY, and that is load-bearing rather than
// scene-setting. The synteny fetch keeps only blocks whose BOTH ends are in
// view (`v1RefNames.has(refName) && v2RefNames.has(mate.refName)`), so a row
// parked on one contig is only ever sent blocks that already point at it: pin
// peach to Pp08 and the only alignments loaded are chr1<->Pp08, the follow
// dutifully places the row inside Pp08, and the test passes while proving
// nothing about which contig the envelope picks.
const ANCHOR_CONTIG = 'chr1'
const EXPECTED_CONTIG = 'Pp01'

interface RowWindow {
  refName: string
  start: number
  end: number
}

// Hoisted rather than inlined at each cast: these annotations are erased before
// puppeteer stringifies the callback, so a shared alias reaches the browser as
// the same code four inline copies would.
interface FollowView {
  followApproximate: boolean
  setFollowAnchorIndex: (i: number) => void
  setRowSyncMode: (m: string) => void
  views: { dynamicBlocks: { contentBlocks: RowWindow[] } }[]
}
type SessionWindow = typeof globalThis & {
  JBrowseSession: { views: FollowView[] }
}

// The visible span of a row, read the way the follow itself reads it.
function windowOfRow(page: Page, index: number) {
  return page.evaluate((i: number) => {
    const blocks = (window as SessionWindow).JBrowseSession.views[0]!.views[i]!
      .dynamicBlocks.contentBlocks
    return {
      refNames: [...new Set(blocks.map(b => b.refName))],
      start: Math.min(...blocks.map(b => b.start)),
      end: Math.max(...blocks.map(b => b.end)),
    }
  }, index)
}

const suite: TestSuite = {
  name: 'Synteny Follow',
  tests: [
    {
      name: 'follow sends the peach row to the contig aligned to grape chr1, at whole-chromosome zoom',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['peach_grape_small'],
                views: [
                  { loc: ANCHOR_CONTIG, assembly: 'grape' },
                  // no loc: the whole peach assembly, so the follow has to
                  // both pick a contig and navigate to it — the navigation the
                  // per-frame pass is not allowed to do on its own
                  { assembly: 'peach' },
                ],
              },
            ],
          },
          grapePeachConfig,
        )
        await waitForDisplayPaint(page, displayPainted('synteny_canvas'), 60000)
        await waitForDataLoaded(page, 60000)

        const before = await windowOfRow(page, 1)
        if (before.refNames.length < 2) {
          throw new Error(
            `expected the peach row to start on the whole assembly, got ${before.refNames.join(',')}`,
          )
        }

        await page.evaluate(() => {
          const view = (window as SessionWindow).JBrowseSession.views[0]!
          view.setFollowAnchorIndex(0)
          view.setRowSyncMode('follow')
        })

        await page.waitForFunction(
          (expected: string) => {
            const blocks = (window as SessionWindow).JBrowseSession.views[0]!
              .views[1]!.dynamicBlocks.contentBlocks
            return (
              blocks.length > 0 && blocks.every(b => b.refName === expected)
            )
          },
          { timeout: 60000, polling: 250 },
          EXPECTED_CONTIG,
        )

        const after = await windowOfRow(page, 1)
        const width = after.end - after.start
        // Bounded rather than exact: which blocks are loaded depends on the
        // viewport cull, so the span's edges move a little. It lands on
        // Pp01:22,442,563-28,948,469 today — 6.5 Mb, and within ~140bp of the
        // envelope computed by hand off the PAF, the difference being the view
        // fitting the span to the pane. The two failures worth catching are
        // unbounded in the other direction: an interpolator reached with a
        // window outside its block collapses to ONE BASE and flings the row to
        // maximum zoom, and a mis-picked envelope spans the whole 47.9 Mb contig.
        if (width < 100_000 || width > 20_000_000) {
          throw new Error(
            `peach row landed on ${after.refNames.join(',')}:${after.start}-${after.end}, ` +
              `a ${width}bp window — expected a few Mb of ${EXPECTED_CONTIG}`,
          )
        }

        // The envelope is a proportional mapping, not a CIGAR walk, and the
        // header says so. Nothing else in the view distinguishes the two, so a
        // flag that stopped being set would be invisible.
        const approximate = await page.evaluate(
          () =>
            (window as SessionWindow).JBrowseSession.views[0]!
              .followApproximate,
        )
        if (!approximate) {
          throw new Error(
            'expected followApproximate on a whole-chromosome window, which no ' +
              'single alignment here covers',
          )
        }
      },
    },
  ],
}

export default suite
