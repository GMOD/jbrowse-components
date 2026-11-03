#!/usr/bin/env node
/**
 * fetch-hprc-launches.ts — save the sessions genomes.jbrowse.org's HPRC page
 * launches, so the pangenome figures draw what a reader's click opens.
 *
 *   node scripts/fetch-hprc-launches.ts
 *
 * The page reads each window's walks in the browser to choose its lanes, so the
 * lane set can only be read off the rendered page. Each launch becomes
 * `specs/hprc_<locus>_<launch>.session.json`. Rerun after the page changes how
 * it allots lanes or which rows a launch opens, then reshoot the figures that
 * read the files.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { launch } from 'puppeteer'

const HPRC_PAGE = 'https://genomes.jbrowse.org/pangenomes/hprc/'

const LAUNCHES = [
  { locus: 'cfh', region: 'chr1:196,740,001-196,850,000', launch: 'Graph' },
  {
    locus: 'cfh',
    region: 'chr1:196,740,001-196,850,000',
    launch: 'Haplotypes',
  },
  {
    locus: 'gstt1',
    region: 'chr22:23,940,001-24,070,000',
    launch: 'Haplotypes',
  },
  {
    locus: 'flna',
    region: 'chrX:154,340,001-154,440,000',
    launch: 'Haplotypes',
  },
]

interface LaunchTrack {
  type?: string
  [key: string]: unknown
}

// A feature track opens as LinearBasicDisplay anyway, and check-specs asks
// that a spec not name it.
function dropDefaultType(track: LaunchTrack | string) {
  if (typeof track !== 'string' && track.type === 'LinearBasicDisplay') {
    const { type, ...rest } = track
    return rest
  } else {
    return track
  }
}

function sessionOf(href: string) {
  const url = new URL(href)
  const params = new URLSearchParams(
    url.searchParams.has('session') ? url.search : url.hash.slice(1),
  )
  const session: {
    views: { tracks: (LaunchTrack | string)[] }[]
  } = JSON.parse(params.get('session')!.replace(/^spec-/, ''))
  return {
    ...session,
    views: session.views.map(view => ({
      ...view,
      tracks: view.tracks.map(dropDefaultType),
    })),
  }
}

const browser = await launch({ args: ['--no-sandbox'] })
const page = await browser.newPage()
for (const { locus, region, launch: label } of LAUNCHES) {
  await page.goto(`${HPRC_PAGE}?region=${encodeURIComponent(region)}`, {
    waitUntil: 'networkidle2',
    timeout: 180_000,
  })
  await page.waitForSelector('.ui-lanes', { timeout: 180_000 })
  const href = await page.evaluate(
    text =>
      [...document.querySelectorAll('a')].find(
        a => a.textContent.trim() === text,
      )?.href,
    label,
  )
  if (href) {
    const file = `specs/hprc_${locus}_${label.toLowerCase()}.session.json`
    writeFileSync(
      fileURLToPath(new URL(file, import.meta.url)),
      `${JSON.stringify(sessionOf(href), null, 2)}\n`,
    )
    console.log(`${file}: ${region}`)
  } else {
    console.error(`no ${label} launch at ${region}`)
    process.exitCode = 1
  }
}
await browser.close()
