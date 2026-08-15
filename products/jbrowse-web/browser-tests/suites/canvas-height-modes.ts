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
    // taste. Below ~60px the isoform cap (`effectiveMaxIsoforms`) collapses every
    // gene to a single transcript: one subfeature label on screen, nothing for it
    // to collide with, and the DOM is identical whether the guard is there or
    // not. The first spelling of this test used 30px and passed against a
    // deliberately broken build. At 150 the cap admits five, three subfeature
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
