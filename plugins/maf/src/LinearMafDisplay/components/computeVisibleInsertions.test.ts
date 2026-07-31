import { computeVisibleInsertions } from './computeVisibleInsertions.ts'
import { emptyMafCoverage } from './coverageTestFixture.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

const enc = new TextEncoder()

// One block at bp 100, `refSeq` with `-` marking reference-insertion columns.
function regionData(refSeq: string, alignments: string[]): MafRegionData {
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

function run(
  refSeq: string,
  alignments: string[],
  { bpPerPx = 1, rowHeight = 15 } = {},
) {
  return computeVisibleInsertions({
    view: {
      visibleRegions: [
        {
          displayedRegionIndex: 0,
          start: 100,
          end: 200,
          screenStartPx: 0,
          reversed: false,
        },
      ],
      bpPerPx,
    },
    rpcDataMap: new Map<number, MafRegionData>([
      [0, regionData(refSeq, alignments)],
    ]),
    rowHeight,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
}

test('one marker per insertion run, anchored at the following reference base', () => {
  // ref  AA-AA : one insertion column, anchored before reference bp 102
  const markers = run('AA-AA', ['AAGAA'])
  expect(markers).toHaveLength(1)
  expect(markers[0]).toMatchObject({ xCenter: 2, length: 1 })
})

test('each aligned row contributes its own marker', () => {
  // row 1 has a gap in the insertion column, so it carries no insertion
  const markers = run('AA-AA', ['AAGAA', 'AA-AA', 'AACAA'])
  expect(markers.map(m => m.rowTop)).toEqual([1.5, 31.5])
})

// At <=1 bp/px distinct anchors already land in distinct pixel columns, which is
// also the only regime where the length label draws — so nothing merges here.
test('adjacent insertions stay separate while zoomed in', () => {
  const markers = run('A-A-A', ['AGAGA'])
  expect(markers.map(m => m.xCenter)).toEqual([1, 2])
})

// Zoomed out the same two anchors share a pixel column. Only the longest is
// drawable there (bar width grows with length), so only it survives.
test('insertions sharing a pixel column collapse to the longest', () => {
  // ref A--A---A: a 2bp insertion then a 3bp one, 1 reference bp apart
  const markers = run('A--A---A', ['AGGACCCA'], { bpPerPx: 1000 })
  expect(markers).toHaveLength(1)
  expect(markers[0]!.length).toBe(3)
})

test('the collapse is per row, not across rows', () => {
  const markers = run('A--A---A', ['AGGACCCA', 'AGGACCCA'], { bpPerPx: 1000 })
  expect(markers.map(m => m.rowTop)).toEqual([1.5, 16.5])
})
