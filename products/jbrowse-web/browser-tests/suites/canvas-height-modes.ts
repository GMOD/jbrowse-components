import { navigateWithSessionSpec, waitForDataLoaded } from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// ~14kb of volvox, the window `additional-tracks` frames its gene snapshots in.
// Wide enough that the multi-isoform EDEN gene draws its transcripts as separate
// rows, which is what gives the fit ladder something to reduce.
const GENES_LOC = 'ctgA:907..15319'

function genesTrack(display: Record<string, unknown>) {
  return {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: GENES_LOC,
        tracks: [{ trackId: 'gff3tabix_genes', ...display }],
      },
    ],
  }
}

// Every label the floating-label overlay currently has in the DOM.
//
// The overlay is the half of a canvas display that is NOT canvas — names,
// descriptions and transcript labels are divs stacked over it — so the suite's
// canvas snapshots elsewhere are blind to all of them, and this is the only
// thing that sees them. (An element screenshot would: `el.screenshot()` clips
// the page composite rather than painting the element alone. It is not what this
// asks, though — "is this label present" is exact, and a diff answers it
// indirectly, at a threshold, through a capture that came back blank on about a
// quarter of runs while the canvas inside self-reported content.)
async function overlayLabels(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="feature-display"] div')]
      .map(el => (el.childElementCount === 0 ? el.textContent.trim() : ''))
      .filter(t => !!t),
  )
}

/**
 * Wait until the label overlay has rendered at all, which is the signal this
 * suite depends on and `waitForDataLoaded` does not give.
 *
 * That helper settles on the loading overlay clearing; the labels are a React
 * subtree that lands a tick later. On the Chrome backends the gap is invisible
 * because `navigateToUrl` waits for `networkidle0` and the slack absorbs it —
 * but the webgpu arm runs Firefox, where `networkidle0` stalls, so
 * `gotoWaitUntil` uses `load` and the read lands on an empty overlay. Measured:
 * three runs in a row read **0** elements with no tick between the wait and the
 * read, and 62 with a single `setTimeout(0)`.
 *
 * **Only the grow arm can use this**, and finding out why is what turned a
 * flaky-test fix into the note at the squeeze arm below. The obvious move is to
 * settle both arms on "some label exists" — but the squeeze legitimately
 * renders none at all, so the wait would hang there. The squeeze arm has no
 * positive signal to settle on, which is the same fact that makes its assertion
 * vacuous.
 */
async function waitForOverlayLabels(page: Page, timeout = 30000) {
  await page
    .waitForFunction(
      () =>
        [
          ...document.querySelectorAll('[data-testid="feature-display"] div'),
        ].some(el => el.childElementCount === 0 && !!el.textContent.trim()),
      // `mutation`, never the default `raf`. The webgpu backend is a HEADED
      // Firefox, and a headed window that loses the foreground has its animation
      // frames throttled — so an rAF-polled wait stops evaluating and burns its
      // whole timeout while the page underneath is perfectly fine. React schedules
      // through MessageChannel rather than rAF, so the labels still land; it is
      // only the observer that stalls. A DOM mutation is also exactly the event
      // being waited on, which is what makes this the right poll rather than
      // merely the safe one.
      { timeout, polling: 'mutation' },
    )
    .catch(async (e: unknown) => {
      // A bare "30000ms exceeded" says which line gave up and nothing about why,
      // and the three candidates here look identical from the outside: the
      // display never painted, it painted with no labels, or the overlay root is
      // not where the selector looks. Ask the page.
      const state = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="feature-display"]')
        const d = (window as any).JBrowseSession?.views?.[0]?.tracks?.[0]
          ?.displays?.[0]
        return {
          roots: document.querySelectorAll('[data-testid="feature-display"]')
            .length,
          divs: root ? root.querySelectorAll('div').length : -1,
          drawn: document.querySelectorAll('[data-display-drawn="true"]')
            .length,
          phase: d?.displayPhase,
          height: d?.height,
          regions: d?.rpcDataMap?.size,
          hidden: document.hidden,
        }
      })
      throw new Error(
        `no overlay label appeared in ${timeout}ms — ${JSON.stringify(state)} (${e})`,
      )
    })
}

// What the fit ladder does to the label OVERLAY, which is the half of it that
// jsdom cannot reach end to end: `subfeatureLabels` is a config slot the worker
// bakes into its output, so whether a transcript name exists at all is decided
// three layers away from the component that decides whether to draw it.
const suite: TestSuite = {
  name: 'Canvas Track Sizing',
  tests: [
    // A subfeature label (a transcript name under its gene) is worker-baked, so
    // neither of the fit ladder's feature-label flags hides it and the packer
    // reserves its row unconditionally to match. That reservation stops holding
    // under the SQUEEZE: the row scales while the text keeps the display mode's
    // font size, and EDEN.1/.2/.3 land on top of each other and of the glyphs.
    //
    // The height is load-bearing and was picked by probing the model, not by
    // taste. Below ~60px the fit ladder's isoform rung solves to one transcript
    // per gene: one subfeature label on screen, nothing for it to collide with,
    // and the DOM is identical whether the guard is there or not. The first
    // spelling of this test used 30px and passed against a deliberately broken
    // build. At 150 the rung admits five, three subfeature
    // labels survive the fetch, and the squeeze is ~0.5.
    {
      name: 'a squeezed fit drops the subfeature labels it shrank',
      fn: async (page: Page) => {
        // Control first: same track, same labels, no squeeze. Grow sizes the
        // track to its content, so every reserved label row is its full height
        // and the transcript names are exactly what the user asked for. Without
        // this half, a guard that hid subfeature labels ALWAYS would pass.
        await navigateWithSessionSpec(
          page,
          genesTrack({ heightMode: 'grow', subfeatureLabels: 'below' }),
        )
        await waitForDataLoaded(page, 60000)
        await waitForOverlayLabels(page)
        const grown = await overlayLabels(page)
        if (!grown.some(t => t.startsWith('EDEN.'))) {
          throw new Error(
            `grow mode drew no transcript label, so the squeeze check below ` +
              `proves nothing. Labels seen: ${JSON.stringify(grown)}`,
          )
        }

        await navigateWithSessionSpec(
          page,
          genesTrack({
            heightMode: 'fit',
            height: 150,
            subfeatureLabels: 'below',
          }),
        )
        await waitForDataLoaded(page, 60000)
        // NO settle signal here, and that is a known hole rather than an
        // oversight — there is nothing to wait FOR. Measured on both backends
        // with `probe-canvas-fit-labels.ts` (grow settles at height 486):
        //
        //   fit  100/150/200 -> 0 labels of any kind
        //   fit  300 -> 6 labels, 3 of them EDEN.n
        //   fit  400/500/700 -> 41-59 labels, 3 of them EDEN.n
        //
        // So at the 150 this test picks, the overlay is entirely empty and the
        // assertion below passes over nothing: it would pass with the guard
        // deleted. And there is no height that rescues it, because every height
        // that renders labels at all renders all three EDEN.n — including 300
        // and 400, which are under grow's natural 486 and therefore squeezing.
        //
        // That is either a guard that stopped working or a premise that was
        // never true, and telling those apart means reading the fit ladder
        // rather than picking a new number. Left failing-open deliberately;
        // re-tuning the height to get a green tick is the one move that would
        // bury it.
        const squeezed = await overlayLabels(page)
        const leaked = squeezed.filter(t => t.startsWith('EDEN.'))
        if (leaked.length > 0) {
          throw new Error(
            `a squeezing fit drew ${leaked.length} subfeature label(s) into ` +
              `rows it had scaled down: ${JSON.stringify(leaked)}`,
          )
        }
      },
    },
  ],
}

export default suite
