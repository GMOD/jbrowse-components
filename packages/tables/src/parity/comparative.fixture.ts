import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { CONTIG_SWAP, INV_INDELS } from '../synteny.fixture.ts'
import { fastaAssembly, fileUri } from './comparative/testEnv.ts'

import type { ComparativeAxis } from './comparative/testEnv.ts'

export interface ComparativeFixture {
  adapterConfig: Record<string, unknown>
  query: ComparativeAxis
  target: ComparativeAxis
}

const VOLVOX = fastaAssembly('volvox', 'test_data/volvox/volvox.fa')
const VOLVOX_INV = fastaAssembly(
  'volvox_random_inv',
  'test_data/volvox/output_prefix3.simseq.genome.fa',
)

const CTGA_INV = { refName: 'ctgA', start: 0, end: 49186 }
const CTGA = { refName: 'ctgA', start: 0, end: 50001 }
const CTGB = { refName: 'ctgB', start: 0, end: 6079 }

/**
 * Seven minimap2 blocks of a volvox with an inversion and indels against
 * volvox ctgA, two reverse, five carrying `zd`, the first three a text `gr`
 * of `a` or `b` and the rest none, and every one `tp`, `P` or `I`.
 */
function labelledInversions() {
  const lines = readFileSync(
    path.resolve('test_data/volvox/volvox_inv_indels.paf'),
    'utf8',
  )
    .trim()
    .split('\n')
    .map((line, i) => (i < 3 ? `${line}\tgr:Z:${i % 2 ? 'b' : 'a'}` : line))
  const dir = mkdtempSync(path.join(tmpdir(), 'parity-paf-'))
  const paf = path.join(dir, 'labelled.paf')
  writeFileSync(paf, `${lines.join('\n')}\n`)
  return {
    ...INV_INDELS.adapterConfig,
    pafLocation: fileUri(paf),
    attributeColumns: ['gr', 'zd', 'tp'],
  }
}

/** Both whole contigs at 800 px, all but one indel sub-pixel. */
export const INVERSIONS: ComparativeFixture = {
  adapterConfig: labelledInversions(),
  query: { assembly: VOLVOX_INV, regions: [CTGA_INV], width: 800 },
  target: { assembly: VOLVOX, regions: [CTGA], width: 800 },
}

/** Both whole contigs at 4000 px, wide enough for a dotplot's CIGAR steps. */
export const INVERSIONS_WIDE: ComparativeFixture = {
  ...INVERSIONS,
  query: { ...INVERSIONS.query, width: 4000 },
  target: { ...INVERSIONS.target, width: 4000 },
}

/** 3 kb of each at 800 px, inside the first block, its indels drawn. */
export const INVERSIONS_ZOOMED: ComparativeFixture = {
  ...INVERSIONS,
  query: {
    assembly: VOLVOX_INV,
    regions: [{ refName: 'ctgA', start: 27000, end: 30000 }],
    width: 800,
  },
  target: {
    assembly: VOLVOX,
    regions: [{ refName: 'ctgA', start: 27450, end: 30450 }],
    width: 800,
  },
}

/**
 * volvox ctgA against ctgB and back, both rows showing ctgB then ctgA, the
 * reverse of the assembly's order.
 */
export const CONTIGS: ComparativeFixture = {
  adapterConfig: CONTIG_SWAP.adapterConfig,
  query: { assembly: VOLVOX, regions: [CTGB, CTGA], width: 800 },
  target: { assembly: VOLVOX, regions: [CTGB, CTGA], width: 800 },
}

/** Both rows on ctgA, so each block's mate is on a contig neither shows. */
export const OFFSCREEN: ComparativeFixture = {
  adapterConfig: CONTIG_SWAP.adapterConfig,
  query: { assembly: VOLVOX, regions: [CTGA], width: 800 },
  target: { assembly: VOLVOX, regions: [CTGA], width: 800 },
}
