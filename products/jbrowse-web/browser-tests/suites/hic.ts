import { Buffer } from 'node:buffer'

import { PNG } from 'pngjs'

import { navigateWithSessionSpec, waitForDataLoaded } from '../helpers.ts'
import { viewSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const CONFIG = 'extra_test_data/hic_integration_test.json'
const CANVAS = '[data-testid="hic_canvas"]'

// Ink per column: sum of darkness down the whole canvas. Summing ~hundreds of
// rows washes out the antialiased diamond edges (whose sub-pixel phase differs
// between the two orientations) while keeping the left-right distribution the
// mirror invariant is about.
function inkProfile(buf: Uint8Array) {
  const png = PNG.sync.read(Buffer.from(buf))
  const out = new Float64Array(png.width)
  for (let x = 0; x < png.width; x++) {
    let ink = 0
    for (let y = 0; y < png.height; y++) {
      const i = (png.width * y + x) << 2
      // hic paints red-on-white; 255-green tracks how saturated a pixel is
      ink += 255 - png.data[i + 1]!
    }
    out[x] = ink
  }
  return out
}

async function capture(page: Page, loc: string) {
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc,
          tracks: ['hic_test'],
        },
      ],
    },
    CONFIG,
  )
  await page.waitForSelector('[data-testid="hic-display-done"]', {
    timeout: 60000,
  })
  await waitForDataLoaded(page, 60000)
  const el = await page.waitForSelector(CANVAS, { timeout: 60000 })
  return inkProfile(await el!.screenshot())
}

const meanAbs = (f: (i: number) => number, n: number) => {
  let s = 0
  for (let i = 0; i < n; i++) {
    s += Math.abs(f(i))
  }
  return s / n
}

const suite: TestSuite = {
  name: 'HiC Track',
  tests: [
    viewSnapshotTest({
      name: 'HiC rendering',
      snapshot: 'hic-rendering',
      config: CONFIG,
      view: {
        type: 'LinearGenomeView',
        assembly: 'hg19',
        loc: 'chr1:1..10,000,000',
        tracks: ['hic_test'],
      },
      waitTestId: 'hic-display-done',
      snapshotSelector: CANVAS,
    }),

    // Property, not a golden: a golden of a reversed matrix would have recorded
    // the very bug this exists for (it rendered pixel-identical to forward, so
    // the snapshot would have looked "fine"). Asserting the mirror invariant
    // instead needs no expected coordinates and holds on every backend.
    {
      name: 'HiC mirrors on a reversed region',
      fn: async page => {
        const fwd = await capture(page, 'chr1:1..10,000,000')
        const rev = await capture(page, 'chr1:1..10,000,000[rev]')
        const n = Math.min(fwd.length, rev.length)

        // guard against a vacuous pass: the fixture has to actually have ink,
        // and has to be left-right asymmetric, or "mirrored" means nothing
        const totalInk = fwd.reduce((a, b) => a + b, 0)
        if (totalInk === 0) {
          throw new Error('forward hic canvas is blank — nothing to compare')
        }
        const asymmetry = meanAbs(i => fwd[i]! - fwd[n - 1 - i]!, n)
        if (asymmetry < 0.05 * (totalInk / n)) {
          throw new Error(
            'forward hic is near-symmetric; the mirror check cannot discriminate',
          )
        }

        const mirrorErr = meanAbs(i => rev[i]! - fwd[n - 1 - i]!, n)
        const identityErr = meanAbs(i => rev[i]! - fwd[i]!, n)
        // Reversed must look like mirrored-forward, and clearly *not* like
        // forward. Before the fix identityErr was 0 (pixel-identical) and this
        // failed hard; the margin is wide enough not to be sub-pixel-flaky.
        if (!(mirrorErr < identityErr / 2)) {
          throw new Error(
            `reversed hic does not mirror: err vs mirrored-forward ${mirrorErr.toFixed(0)} should be well under err vs forward ${identityErr.toFixed(0)} (identical to forward means 'reversed' was ignored)`,
          )
        }
      },
    },
  ],
}

export default suite
