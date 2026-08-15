import { computeVisibleDeletions } from './computeVisibleDeletions.ts'
import { emptyMafCoverage } from './coverageTestFixture.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

const enc = new TextEncoder()

function regionData(refSeq: string, alignment: string): MafRegionData {
  return {
    blocks: [
      {
        startBp: 100,
        endBp: 100 + refSeq.replaceAll('-', '').length,
        refSeqBytes: enc.encode(refSeq),
        rows: [{ rowIndex: 0, alignmentBytes: enc.encode(alignment) }],
        empties: [],
      },
    ],
    coverage: emptyMafCoverage(100),
  }
}

// 1 bp per px unless a test says otherwise, so a run's px width equals its
// length and the label-fit threshold is easy to straddle.
function view(bpPerPx = 1) {
  return {
    visibleRegions: [
      {
        displayedRegionIndex: 0,
        start: 100,
        end: 140,
        screenStartPx: 0,
        reversed: false,
      },
    ],
    bpPerPx,
  }
}

function run(
  refSeq: string,
  alignment: string,
  { rowHeight = 15, bpPerPx = 1 } = {},
) {
  return computeVisibleDeletions({
    view: view(bpPerPx),
    rpcDataMap: new Map<number, MafRegionData>([
      [0, regionData(refSeq, alignment)],
    ]),
    rowHeight,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
}

test('a deletion run wide enough for its label becomes a marker', () => {
  // 20bp gap at 1bp/px = 20px wide, comfortably past the label threshold
  const markers = run('A'.repeat(30), `AAAAA${'-'.repeat(20)}AAAAA`)
  expect(markers).toHaveLength(1)
  expect(markers[0]!.length).toBe(20)
  expect(markers[0]!.xLeft).toBe(5)
  expect(markers[0]!.width).toBe(20)
})

// The overlay draws only the count label, so a run too narrow to fit one can
// never paint. Emitting it anyway meant allocating a marker per gap run purely
// for the draw pass to re-test and discard.
test('runs too narrow for any label are not emitted', () => {
  const markers = run('A'.repeat(30), `AAAAA${'-'.repeat(20)}AAAAA`, {
    bpPerPx: 100,
  })
  expect(markers).toEqual([])
})

// Same gate computeVisibleLabels applies, so all row text reveals together.
// Unlike insertions there is no bar to draw underneath it, so below the
// threshold the whole walk is dead work.
test('a band too short for text emits nothing at all', () => {
  const markers = run('A'.repeat(30), `AAAAA${'-'.repeat(20)}AAAAA`, {
    rowHeight: 4,
  })
  expect(markers).toEqual([])
})

test('a band just above the text threshold still emits', () => {
  // h = rowHeight * 0.8, so rowHeight 7 → 5.6, past MIN_HEIGHT_FOR_TEXT (5)
  expect(
    run('A'.repeat(30), `AAAAA${'-'.repeat(20)}AAAAA`, { rowHeight: 7 }),
  ).toHaveLength(1)
})

test('reference gap columns break a run and consume no coordinate', () => {
  // ref A-A: the middle column is an insertion column, so the two gap runs
  // either side are separate deletions rather than one spanning run.
  const markers = run(
    `${'A'.repeat(5)}${'A'.repeat(10)}-${'A'.repeat(10)}${'A'.repeat(5)}`,
    `${'A'.repeat(5)}${'-'.repeat(10)}C${'-'.repeat(10)}${'A'.repeat(5)}`,
  )
  expect(markers.map(m => m.length)).toEqual([10, 10])
  expect(markers.map(m => m.xLeft)).toEqual([5, 15])
})

test('multiple rows each contribute their own markers', () => {
  const gapped = `AAAAA${'-'.repeat(20)}AAAAA`
  const rpcDataMap = new Map<number, MafRegionData>([
    [
      0,
      {
        blocks: [
          {
            startBp: 100,
            endBp: 130,
            refSeqBytes: enc.encode('A'.repeat(30)),
            rows: [
              { rowIndex: 0, alignmentBytes: enc.encode(gapped) },
              { rowIndex: 1, alignmentBytes: enc.encode('A'.repeat(30)) },
              { rowIndex: 2, alignmentBytes: enc.encode(gapped) },
            ],
            empties: [],
          },
        ],
        coverage: emptyMafCoverage(100),
      },
    ],
  ])
  const markers = computeVisibleDeletions({
    view: view(),
    rpcDataMap,
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  // row 1 is ungapped, so only rows 0 and 2 mark
  expect(markers.map(m => m.rowTop)).toEqual([1.5, 31.5])
})

// The two tests below pin what a block's cached longest-run bound may depend on.
// Both hand the *same* region object to two calls, which is what the cache keys
// on — a fresh one each time would measure nothing.
function rowsRegion(refSeq: string, alignments: string[]): MafRegionData {
  return {
    blocks: [
      {
        startBp: 100,
        endBp: 100 + refSeq.replaceAll('-', '').length,
        refSeqBytes: enc.encode(refSeq),
        rows: alignments.map((alignment, rowIndex) => ({
          rowIndex,
          alignmentBytes: enc.encode(alignment),
        })),
        empties: [],
      },
    ],
    coverage: emptyMafCoverage(100),
  }
}

function frame(
  data: MafRegionData,
  { bpPerPx = 1, scrollTop = 0, viewportHeight = 1000 } = {},
) {
  return computeVisibleDeletions({
    view: view(bpPerPx),
    rpcDataMap: new Map([[0, data]]),
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop,
    viewportHeight,
  })
}

// Taken over every row, not the ones on screen when it was filled — otherwise
// scrolling to a deep row with longer runs finds the block already culled.
test('a bound filled while a row was scrolled off still admits that row', () => {
  const short = `AAAAA${'-'.repeat(3)}AAAAAAAAAAAAAAAAAAAAAA`
  const long = `AAAAA${'-'.repeat(20)}AAAAA`
  const rows = [short, short, short, short, short, long]
  const data = rowsRegion('A'.repeat(30), rows)

  // one row tall, so the first call sees row 0 only and never touches row 5
  expect(frame(data, { viewportHeight: 15 })).toEqual([])
  const scrolled = frame(data, { scrollTop: 75, viewportHeight: 15 })
  expect(scrolled.map(m => m.length)).toEqual([20])
})

// ...and a length, not a verdict about the zoom it was filled at.
test('a bound filled at a zoom where nothing labelled admits a closer one', () => {
  const data = rowsRegion('A'.repeat(30), [`AAAAA${'-'.repeat(20)}AAAAA`])

  expect(frame(data, { bpPerPx: 3 })).toEqual([])
  expect(frame(data, { bpPerPx: 1 }).map(m => m.length)).toEqual([20])
})
