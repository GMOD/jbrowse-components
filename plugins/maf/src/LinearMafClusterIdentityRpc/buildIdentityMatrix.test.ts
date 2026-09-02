import { SimpleFeature } from '@jbrowse/core/util'

import { buildIdentityMatrix } from './buildIdentityMatrix.ts'

import type { Feature } from '@jbrowse/core/util'

// One block, one row per genome, hand-written so each assertion below names the
// sequence it is about. `alignments[x].seq` is the aligned string in the same
// column space as the reference's, which is what the builder walks.
function block({
  start,
  ref,
  rows,
  refName = 'chr1',
}: {
  start: number
  ref: string
  rows: Record<string, string>
  refName?: string
}) {
  return new SimpleFeature({
    uniqueId: `block-${refName}-${start}`,
    refName,
    start,
    end: start + ref.replaceAll('-', '').length,
    seq: ref,
    alignments: Object.fromEntries(
      Object.entries(rows).map(([id, seq]) => [
        id,
        { seq, start, chr: refName },
      ]),
    ),
    empties: {},
  })
}

function fakePluginManager(features: Feature[]) {
  return {
    features,
  } as never
}

// getAdapter is reached through loadMafSamplesAdapter, so the module is mocked
// rather than the adapter constructed: the builder's contract is with
// `getFeatures` + `getSamples` and nothing else.
jest.mock('../util/loadMafSamplesAdapter.ts', () => ({
  loadMafSamplesAdapter: (pluginManager: { features: Feature[] }) => ({
    adapter: {
      // filtered by region, so a two-region case sees only its own blocks —
      // which is what the per-region column segments are about
      getFeatures: (region: { refName: string; start: number; end: number }) =>
        // required inside the factory: jest hoists this above the imports, so a
        // module referenced from the enclosing scope is not defined yet
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('rxjs').from(
          pluginManager.features.filter(
            f =>
              f.get('refName') === region.refName &&
              f.get('start') < region.end &&
              f.get('end') > region.start,
          ),
        ),
    },
    samples: [],
    treeNewick: undefined,
  }),
}))

const REGION = {
  refName: 'chr1',
  assemblyName: 'test',
  start: 0,
  end: 8,
}

async function matrixOf(features: Feature[], sources: string[]) {
  return buildIdentityMatrix({
    pluginManager: fakePluginManager(features),
    args: {
      adapterConfig: {},
      regions: [REGION],
      sessionId: 'test',
      sources,
    },
  })
}

describe('buildIdentityMatrix', () => {
  // The distinction the whole encoding exists for. `absent` aligns nothing;
  // `diverged` aligns everything and matches half. Both must be scored against
  // the BIN, so absence lands below divergence rather than beside it.
  it('scores absence below divergence, against the bin', async () => {
    const m = await matrixOf(
      [
        block({
          start: 0,
          ref: 'ACGTACGT',
          rows: {
            ref: 'ACGTACGT',
            diverged: 'ACGTTGCA',
            absent: '--------',
          },
        }),
      ],
      ['ref', 'diverged', 'absent'],
    )
    // one reference base per column at this span, so each cell is 0 or 1
    expect([...m.get('ref')!]).toEqual([1, 1, 1, 1, 1, 1, 1, 1])
    expect([...m.get('diverged')!]).toEqual([1, 1, 1, 1, 0, 0, 0, 0])
    expect([...m.get('absent')!]).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })

  // Row order is the caller's contract: `order` comes back as indices into this
  // map, and `buildClusteredLayout` applies them to the display's own array. A
  // map seeded from the file's first block instead would permute silently.
  it('emits rows in the order `sources` names, not the block order', async () => {
    const m = await matrixOf(
      [
        block({
          start: 0,
          ref: 'ACGTACGT',
          rows: { zeta: 'ACGTACGT', alpha: 'ACGTACGT' },
        }),
      ],
      ['alpha', 'zeta'],
    )
    expect([...m.keys()]).toEqual(['alpha', 'zeta'])
  })

  // A genome the display draws but no block covers still needs a leaf, or the
  // tree is one short of the rows and computeClusterHierarchy draws nothing.
  it('keeps an all-zero row for a genome no block covers', async () => {
    const m = await matrixOf(
      [block({ start: 0, ref: 'ACGTACGT', rows: { ref: 'ACGTACGT' } })],
      ['ref', 'never-seen'],
    )
    expect([...m.get('never-seen')!]).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })

  // A genome in the file that the display is NOT drawing must not reach the
  // matrix: it would shift every index after it and misapply the whole order.
  it('drops a genome the display is not drawing', async () => {
    const m = await matrixOf(
      [
        block({
          start: 0,
          ref: 'ACGTACGT',
          rows: { ref: 'ACGTACGT', hidden: 'ACGTACGT' },
        }),
      ],
      ['ref'],
    )
    expect([...m.keys()]).toEqual(['ref'])
  })

  // A reference-gap column belongs to some other genome's insertion. Scoring it
  // would let one haplotype's insert move every row's identity, so the walk
  // counts reference positions rather than alignment columns.
  it('ignores columns where the reference is a gap', async () => {
    const m = await matrixOf(
      [
        block({
          start: 0,
          ref: 'AC--GTAC',
          rows: {
            ref: 'AC--GTAC',
            inserter: 'ACTTGTAC',
          },
        }),
      ],
      ['ref', 'inserter'],
    )
    // six reference positions, all matched by both rows; the two gap columns
    // contribute no bin at all, so the tail of the row stays at zero
    expect([...m.get('inserter')!]).toEqual([1, 1, 1, 1, 1, 1, 0, 0])
  })

  // Two chromosomes shared one set of bins when the ruler ran from min(starts)
  // to max(ends), so a row present in one region and absent in the other scored
  // as half-diverged everywhere instead of present-here-absent-there.
  it('gives each region its own columns', async () => {
    const m = await buildIdentityMatrix({
      pluginManager: fakePluginManager([
        block({
          start: 0,
          ref: 'ACGTACGT',
          rows: { ref: 'ACGTACGT', chr2only: '--------' },
        }),
        block({
          refName: 'chr2',
          start: 0,
          ref: 'ACGTACGT',
          rows: { ref: 'ACGTACGT', chr2only: 'ACGTACGT' },
        }),
      ]),
      args: {
        adapterConfig: {},
        regions: [REGION, { ...REGION, refName: 'chr2' }],
        sessionId: 'test',
        sources: ['ref', 'chr2only'],
      },
    })
    expect([...m.get('ref')!]).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ])
    expect([...m.get('chr2only')!]).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1,
    ])
  })

  // Soft-masked repeat runs are lower case in most MAFs, and a masked match is
  // still a match.
  it('matches case-insensitively', async () => {
    const m = await matrixOf(
      [
        block({
          start: 0,
          ref: 'ACGTACGT',
          rows: { masked: 'acgtacgt' },
        }),
      ],
      ['masked'],
    )
    expect([...m.get('masked')!]).toEqual([1, 1, 1, 1, 1, 1, 1, 1])
  })
})
