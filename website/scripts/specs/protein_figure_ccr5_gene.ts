import { deflateSync } from 'node:zlib'

import { displayPainted } from '@jbrowse/browser-test-utils'

import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { readSession } from './protein_variants.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// demos/ccr5 defines hg38 and the Δ32 allele as its own assembly, so the gene
// model on each side is drawn from that side's own coordinates. The build that
// wrote them, and the coordinate map between the two, are demos/ccr5/README.txt.
const CCR5_CONFIG = 'https://jbrowse.org/demos/ccr5/config.json'

function ccr5GeneSession() {
  const session = readSession('ccr5_delta32_gene.session.json')
  return `?config=${CCR5_CONFIG}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

export const proteinCcr5GeneSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/ccr5_delta32_gene',
    url: ccr5GeneSession(),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 300000,
    tooltip: 'hide',
    viewportWidth: 1800,
    viewportHeight: 664,
    actions: [
      { type: 'waitForAppSettled' },
      PARK_CURSOR,
      { type: 'delay', ms: 500 },
    ],
    // No callout: the Δ32 track's own features say "31 novel residues" and
    // "premature stop", and the two CDS bars differ in length on their own.
    annotations: [],
  },
]
