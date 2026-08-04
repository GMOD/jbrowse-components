import { waitFor } from '@testing-library/react'

import { createMafTestEnvironment } from './testEnv.ts'

import type { MafAlignedRow } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

// A LinearMafGetAlignmentData result with no blocks; `samples` is what each test
// varies, since that (not the block content) is what drives the cache key here.
// `samplesCanonical` false makes it a sample-discovery result, which the display
// unions rather than replaces.
function makeMafResult(
  samples: { id: string; label: string }[],
  samplesCanonical = true,
  // Sample ids to emit one aligned row for, in the worker's own order. Left
  // empty except where a test is about placement — the worker names rows and
  // never positions them, so the client's order is the only thing that decides
  // where they land.
  rowSampleIds: string[] = [],
) {
  return {
    samples,
    treeNewick: undefined,
    samplesCanonical,
    regionData: {
      blocks: rowSampleIds.length
        ? [
            {
              startBp: 0,
              endBp: 4,
              refSeqBytes: new TextEncoder().encode('ACGT'),
              rows: rowSampleIds.map(sampleId => ({
                sampleId,
                alignmentBytes: new TextEncoder().encode('ACGT'),
              })),
              empties: [],
            },
          ]
        : [],
      coverage: {
        coverageDepths: new Float32Array(0),
        coverageStartPos: 0,
        coverageMaxDepth: 0,
        identityScores: new Float32Array(0),
        mismatchPositions: new Uint32Array(0),
        mismatchBases: new Uint8Array(0),
        insertionPositions: new Uint32Array(0),
        insertionLengths: new Uint32Array(0),
        coveragePackedBuffer: { data: new Uint8Array(0), width: 0, height: 0 },
        snpPackedBuffer: new ArrayBuffer(0),
        interbasePackedBuffer: new ArrayBuffer(0),
        interbaseMaxCount: 0,
        indicatorPackedBuffer: new ArrayBuffer(0),
      },
    },
  }
}

const HG38_MM10 = [
  { id: 'hg38', label: 'hg38' },
  { id: 'mm10', label: 'mm10' },
]

// Run the fetch autorun to quiescence: each pass advances past the 600 ms
// FetchVisibleRegions debounce and drains the RPC promises, so any refetch
// SettingsInvalidate schedules gets a chance to run and be counted.
async function settle(
  display: { loadedRegions: { size: number } },
  nRegions = 1,
) {
  for (let i = 0; i < 6; i++) {
    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(nRegions)
    })
  }
}

// Every placed row in the loaded regions as [sampleId, rowIndex], sorted by
// sample so a test states the placement rather than the worker's emit order.
function placedRows(display: {
  rpcDataMap: Map<number, { blocks: { rows: MafAlignedRow[] }[] }>
}) {
  return [...display.rpcDataMap.values()]
    .flatMap(d => d.blocks.flatMap(b => b.rows))
    .map(r => [r.sampleId, r.rowIndex])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
}

function alignmentCalls(mockRpcCall: jest.Mock) {
  return mockRpcCall.mock.calls.filter(
    c => c[1] === 'LinearMafGetAlignmentData',
  )
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('LinearMafDisplay alignment fetch count', () => {
  // Regression: `rpcProps()` used to return `orderedSampleIds`, which is derived
  // from the fetch result — undefined before the first one, defined after. That
  // flipped `rpcPropsCacheKey` the moment the samples landed, so
  // SettingsInvalidate discarded the region that had just arrived and the whole
  // (heaviest-in-the-plugin) payload was downloaded a second time on every single
  // track load.
  it('fetches a region once when the sample set is stable', async () => {
    const { createDisplay, mockRpcCall } = createMafTestEnvironment({
      assemblyEnd: 50_000,
      viewRegionEnd: 10_000,
    })
    mockRpcCall.mockImplementation(() =>
      Promise.resolve(makeMafResult(HG38_MM10)),
    )
    const { display } = createDisplay()
    await settle(display)

    expect(alignmentCalls(mockRpcCall)).toHaveLength(1)
    expect(display.sources?.map((s: { name: string }) => s.name)).toEqual([
      'hg38',
      'mm10',
    ])
  })

  // A grown sample set is a re-place, not a refetch. It used to bump a
  // `sampleSetGeneration` counter into `rpcProps()`, from a design where the
  // worker narrowed each region's blocks to the client's sample list and so
  // genuinely lost rows it had not been told about. The worker discovers its own
  // rows now and names them, so the rows already in hand are complete and the
  // placement autorun re-places them against the widened order — the counter was
  // only re-downloading every loaded region, once per newly seen genome.
  it('re-places, without refetching, when the sample set grows', async () => {
    const { createDisplay, mockRpcCall } = createMafTestEnvironment({
      assemblyEnd: 50_000,
      viewRegionEnd: 10_000,
    })
    mockRpcCall.mockImplementation((_id, method) =>
      Promise.resolve(
        method === 'LinearMafGetAlignmentData'
          ? makeMafResult(HG38_MM10, true, ['hg38', 'mm10'])
          : makeMafResult([]),
      ),
    )
    const { display } = createDisplay()
    await settle(display)
    expect(alignmentCalls(mockRpcCall)).toHaveLength(1)

    // rn6 sorts ahead of the other two in the new canonical set, so every
    // already-fetched row has to move for the re-placement to be right.
    mockRpcCall.mockImplementation((_id, method) =>
      Promise.resolve(
        method === 'LinearMafGetAlignmentData'
          ? makeMafResult([{ id: 'rn6', label: 'rn6' }, ...HG38_MM10], true, [
              'hg38',
              'mm10',
            ])
          : makeMafResult([]),
      ),
    )
    display.reload()
    await settle(display)

    expect(display.sources?.map((s: { name: string }) => s.name)).toEqual([
      'rn6',
      'hg38',
      'mm10',
    ])
    expect(placedRows(display)).toEqual([
      ['hg38', 1],
      ['mm10', 2],
    ])
    // the reload's fetch and nothing more: no invalidation round behind it
    expect(alignmentCalls(mockRpcCall)).toHaveLength(2)
  })

  // Regression: a sample-discovery track's regions can align different genomes.
  // One region's set used to stand for the whole batch, so rn6, discovered only
  // in the second region, had no row to be placed at and rendered nothing. The
  // union covers both regions, and being additive it settles on the first pass.
  it('unions genomes discovered in different regions', async () => {
    const { createDisplay, mockRpcCall } = createMafTestEnvironment({
      assemblyEnd: 50_000,
      viewRegionEnd: 10_000,
    })
    mockRpcCall.mockImplementation((_id, method, args) =>
      Promise.resolve(
        method === 'LinearMafGetAlignmentData'
          ? makeMafResult(
              args.regions[0].start === 0
                ? HG38_MM10
                : [
                    { id: 'hg38', label: 'hg38' },
                    { id: 'rn6', label: 'rn6' },
                  ],
              false,
            )
          : makeMafResult([], false),
      ),
    )
    // both narrow enough to sit in the 800px viewport at the default bpPerPx, so
    // one batch buffers the pair
    const { display } = createDisplay({
      regions: [
        { assemblyName: 'volvox', start: 0, end: 400, refName: 'ctgA' },
        { assemblyName: 'volvox', start: 1000, end: 1400, refName: 'ctgA' },
      ],
    })
    await settle(display, 2)

    expect(display.sources?.map((s: { name: string }) => s.name)).toEqual([
      'hg38',
      'mm10',
      'rn6',
    ])
    expect(alignmentCalls(mockRpcCall)).toHaveLength(2)
  })
})

describe('LinearMafDisplay row placement', () => {
  // A session that ARRIVES with a row arrangement (share link, screenshot spec)
  // has a `layout` before it has any data, and labels its rows from it. The
  // fetch that DISCOVERS the row set cannot state that set, so it used to send
  // canonical order and the client drew every row under another row's name.
  // Nothing about order is sent now: rows come back named, and the client
  // places them against the list it draws.
  it('sends no row order, whatever the arrangement', async () => {
    const { createDisplay, mockRpcCall } = createMafTestEnvironment({
      assemblyEnd: 50_000,
      viewRegionEnd: 10_000,
    })
    mockRpcCall.mockImplementation(() =>
      Promise.resolve(makeMafResult(HG38_MM10)),
    )
    const { display } = createDisplay({
      displaySnapshot: { layout: [{ name: 'mm10' }, { name: 'hg38' }] },
    })
    await settle(display)

    const calls = alignmentCalls(mockRpcCall)
    expect(calls).toHaveLength(1)
    expect(calls[0]![2]).not.toHaveProperty('orderedSampleIds')
    expect(display.sources?.map((s: { name: string }) => s.name)).toEqual([
      'mm10',
      'hg38',
    ])
  })

  // The payoff for taking row order out of the RPC: a reorder is a re-place of
  // data already in hand. Under positional identity this refetched the heaviest
  // payload in the plugin, because `layoutOrder` had to be part of the cache
  // key for the worker to renumber the rows.
  it('re-places cached rows on a reorder, without refetching', async () => {
    const { createDisplay, mockRpcCall } = createMafTestEnvironment({
      assemblyEnd: 50_000,
      viewRegionEnd: 10_000,
    })
    mockRpcCall.mockImplementation((_id, method) =>
      Promise.resolve(
        method === 'LinearMafGetAlignmentData'
          ? makeMafResult(HG38_MM10, true, ['hg38', 'mm10'])
          : makeMafResult([]),
      ),
    )
    const { display } = createDisplay()
    await settle(display)
    expect(alignmentCalls(mockRpcCall)).toHaveLength(1)
    expect(placedRows(display)).toEqual([
      ['hg38', 0],
      ['mm10', 1],
    ])

    display.setLayout([{ name: 'mm10' }, { name: 'hg38' }])
    await settle(display)

    expect(placedRows(display)).toEqual([
      ['hg38', 1],
      ['mm10', 0],
    ])
    expect(alignmentCalls(mockRpcCall)).toHaveLength(1)
  })

  // The bug this all comes from: a session ARRIVES with a saved layout naming a
  // genome this region has no alignment for. The reply's rows used to be
  // numbered against a list the display did not draw, so every row below the
  // missing one drew under another row's name.
  it('places correctly when the layout names a genome the reply lacks', async () => {
    const { createDisplay, mockRpcCall } = createMafTestEnvironment({
      assemblyEnd: 50_000,
      viewRegionEnd: 10_000,
    })
    mockRpcCall.mockImplementation((_id, method) =>
      Promise.resolve(
        method === 'LinearMafGetAlignmentData'
          ? makeMafResult(HG38_MM10, true, ['hg38', 'mm10'])
          : makeMafResult([]),
      ),
    )
    const { display } = createDisplay({
      displaySnapshot: {
        layout: [{ name: 'mm10' }, { name: 'rn6' }, { name: 'hg38' }],
      },
    })
    await settle(display)

    // rn6 is in the layout but not in the sample set, so it is not a drawn row;
    // the two that are drawn keep their layout positions rather than sliding up
    expect(display.sources?.map((s: { name: string }) => s.name)).toEqual([
      'mm10',
      'hg38',
    ])
    expect(placedRows(display)).toEqual([
      ['hg38', 1],
      ['mm10', 0],
    ])
  })

  // The subtree filter still travels, as a row *set*: the worker ships only
  // those genomes and scopes coverage to them.
  it('sends the subtree filter as a set', async () => {
    const { createDisplay, mockRpcCall } = createMafTestEnvironment({
      assemblyEnd: 50_000,
      viewRegionEnd: 10_000,
    })
    mockRpcCall.mockImplementation(() =>
      Promise.resolve(makeMafResult(HG38_MM10)),
    )
    const { display } = createDisplay({
      displaySnapshot: {
        layout: [{ name: 'mm10' }, { name: 'hg38' }],
        subtreeFilter: ['hg38'],
      },
    })
    await settle(display)

    const [first] = alignmentCalls(mockRpcCall)
    expect(first![2].subtreeFilter).toEqual(['hg38'])
    expect(display.sources?.map((s: { name: string }) => s.name)).toEqual([
      'hg38',
    ])
  })
})
