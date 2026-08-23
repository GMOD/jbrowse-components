import {
  BASE_CHROME_ARGS,
  createTestServer,
  encodeSessionSpec,
  findChromeExecutable,
  pendingDisplayStatesInPage,
} from '@jbrowse/browser-test-utils'
import puppeteer from 'puppeteer'

import type { Page } from 'puppeteer'

// Does an alignments-family display finish loading when its fetch lands on
// NOTHING? The loading scrim comes down on `canvasDrawn`, which the backends
// flip off `renderBlocks`, and both of them used to answer "did a band with
// non-zero height paint" — so a display with the coverage band off and no reads
// to stack reported nothing drawn forever. It is not a synteny bug and not an
// adapter bug: the two cases below are one code path reached from a chain file
// and from a BAM.
//
//   node browser-tests/probe-empty-region-paint.ts [synteny|bam] [loc] [budgetMs]
//
// Both scenarios must print painted=true. The default synteny locus is chrX on
// the hosted HG002 demo, whose maternal-to-paternal chain pairs only contigs
// that HAVE a counterpart — HG002 is male, so chrX_MATERNAL and chrY_PATERNAL
// appear in no record in the file.
const HG002_CONFIG = 'https://jbrowse.org/demos/hg002/config.json'
const PORT = 3398

const BAM_URI = '/test_data/volvox/volvox-long-reads-sv.bam'

const scenarios = {
  // A SyntenyTrack lane in a plain LGV: LGVSyntenyDisplay overrides
  // `showCoverage` to false, so an empty window leaves no band at all.
  synteny: {
    config: HG002_CONFIG,
    defaultLoc: 'chrX_MATERNAL:60,000,000-60,070,000',
    session: (loc: string) => ({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg002v1.2',
          loc,
          tracks: [{ trackId: 'hg002v1.2_mat_vs_pat', height: 100 }],
        },
      ],
    }),
  },
  // The same display state off a BAM, reached by turning the coverage band off
  // by hand. ctgA:45,000-46,000 carries no reads in this file.
  bam: {
    config: 'test_data/volvox/config.json',
    defaultLoc: 'ctgA:45,000-46,000',
    session: (loc: string) => ({
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'nocov_bam',
          name: 'Long reads, coverage band off',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: { uri: BAM_URI, locationType: 'UriLocation' },
            index: {
              location: {
                uri: `${BAM_URI}.bai`,
                locationType: 'UriLocation',
              },
            },
          },
          displays: [
            {
              type: 'LinearAlignmentsDisplay',
              displayId: 'nocov_bam-LinearAlignmentsDisplay',
              showCoverage: false,
            },
          ],
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc,
          tracks: [{ trackId: 'nocov_bam', height: 100 }],
        },
      ],
    }),
  },
}

function displayState(page: Page) {
  return page.evaluate(() => {
    const session = (window as unknown as { JBrowseSession?: unknown })
      .JBrowseSession as
      | {
          views?: {
            tracks?: {
              displays?: {
                displayPhase?: string
                canvasDrawn?: boolean
                showCoverage?: boolean
                isLoading?: boolean
                error?: unknown
                rpcDataMap?: { size: number }
              }[]
            }[]
          }[]
        }
      | undefined
    const d = session?.views?.[0]?.tracks?.[0]?.displays?.[0]
    return d
      ? {
          phase: d.displayPhase,
          canvasDrawn: d.canvasDrawn,
          showCoverage: d.showCoverage,
          isLoading: d.isLoading,
          error: String(d.error ?? ''),
          fetched: d.rpcDataMap?.size,
        }
      : undefined
  })
}

async function main() {
  const which = process.argv[2] ?? 'synteny'
  const scenario = Object.entries(scenarios).find(([n]) => n === which)?.[1]
  if (!scenario) {
    throw new Error(`unknown scenario ${which}`)
  }
  const loc = process.argv[3] ?? scenario.defaultLoc
  const budgetMs = Number(process.argv[4] ?? 60_000)

  const server = await createTestServer(PORT, {
    jbrowseWebRoot: new URL('..', import.meta.url).pathname,
    repoRoot: new URL('../../..', import.meta.url).pathname,
  })
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: findChromeExecutable(),
    args: BASE_CHROME_ARGS,
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1200, height: 700 })
  page.on('pageerror', err => {
    console.log(`[pageerror] ${String(err)}`)
  })

  const url = `http://localhost:${PORT}/?config=${scenario.config}&session=${encodeSessionSpec(scenario.session(loc))}&sessionName=Probe`
  console.log(`${which}: ${loc}`)
  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'domcontentloaded' })

  let painted = false
  while (!painted && Date.now() - t0 < budgetMs) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    const pending = await page.evaluate(pendingDisplayStatesInPage)
    const state = await displayState(page)
    console.log(
      `t=${((Date.now() - t0) / 1000).toFixed(0)}s pending=${JSON.stringify(pending)} ${JSON.stringify(state)}`,
    )
    painted = pending.length === 0 && state?.canvasDrawn === true
  }
  console.log(
    `RESULT ${which} loc=${loc} painted=${painted} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`,
  )
  await browser.close()
  server.close()
}

await main()
