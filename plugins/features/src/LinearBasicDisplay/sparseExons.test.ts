import {
  RECT_FLAG_DENSITY_FADE,
  RECT_FLAG_SPARSE_EXONS,
} from './components/sharedRendererConstants.ts'
import { applySparseExonFlags } from './sparseExons.ts'

const genomic = (bp: number) => bp

function transcriptRects(
  spans: [number, number][],
  opts: { collapsibleIntrons?: boolean; ordinals?: number[] } = {},
) {
  return {
    rectPositions: Uint32Array.from(spans.flat()),
    rectFeatureIndices: new Uint32Array(spans.length),
    rectChildOrdinals: Uint16Array.from(opts.ordinals ?? []),
    rectDensityFade: new Uint32Array(spans.length),
    flatbushItems: [{ collapsibleIntrons: opts.collapsibleIntrons ?? true }],
  }
}

function sparseFlags(data: { rectDensityFade: Uint32Array }) {
  return [...data.rectDensityFade].map(f => (f & RECT_FLAG_SPARSE_EXONS) !== 0)
}

test('exons separated by long introns widen', () => {
  const data = transcriptRects([
    [0, 100],
    [10_000, 10_100],
    [20_000, 20_100],
  ])
  applySparseExonFlags(data, 100, genomic)
  expect(sparseFlags(data)).toEqual([true, true, true])
})

test('exons whose introns are a pixel or two stay at the narrow floor', () => {
  const data = transcriptRects([
    [0, 100],
    [250, 350],
    [500, 600],
  ])
  applySparseExonFlags(data, 100, genomic)
  expect(sparseFlags(data)).toEqual([false, false, false])
})

test('roomy introns between clusters do not widen the clusters', () => {
  const spans: [number, number][] = [
    [0, 50],
    [150, 200],
    [300, 350],
    [50_000, 50_050],
    [100_000, 100_050],
    [150_000, 150_050],
  ]
  const data = transcriptRects(spans)
  applySparseExonFlags(data, 100, genomic)
  expect(sparseFlags(data)).toEqual(spans.map(() => false))
})

test('abutting CDS and UTR pieces count as one exon, not a 0bp intron', () => {
  const data = transcriptRects([
    [0, 40],
    [40, 100],
    [10_000, 10_100],
  ])
  applySparseExonFlags(data, 100, genomic)
  expect(sparseFlags(data)).toEqual([true, true, true])
})

test('a single-exon feature keeps the narrow floor', () => {
  const data = transcriptRects([[0, 100]])
  applySparseExonFlags(data, 100, genomic)
  expect(sparseFlags(data)).toEqual([false])
})

test('gapped parts of a feature without introns keep the narrow floor', () => {
  const data = transcriptRects(
    [
      [0, 100],
      [10_000, 10_100],
    ],
    { collapsibleIntrons: false },
  )
  applySparseExonFlags(data, 100, genomic)
  expect(sparseFlags(data)).toEqual([false, false])
})

test('each isoform of a gene decides on its own introns', () => {
  const data = transcriptRects(
    [
      [0, 100],
      [10_000, 10_100],
      [0, 100],
      [250, 350],
    ],
    { ordinals: [0, 0, 1, 1] },
  )
  applySparseExonFlags(data, 100, genomic)
  expect(sparseFlags(data)).toEqual([true, true, false, false])
})

test('a collapsed intron is measured as drawn', () => {
  const data = transcriptRects([
    [0, 100],
    [10_000, 10_100],
  ])
  const collapsed = (bp: number) => (bp >= 10_000 ? bp - 9800 : bp)
  applySparseExonFlags(data, 100, collapsed)
  expect(sparseFlags(data)).toEqual([false, false])
})

test('the sparse bit leaves the density-fade bit alone', () => {
  const data = transcriptRects([
    [0, 100],
    [10_000, 10_100],
  ])
  data.rectDensityFade[0] = RECT_FLAG_DENSITY_FADE
  applySparseExonFlags(data, 100, genomic)
  expect([...data.rectDensityFade]).toEqual([
    RECT_FLAG_DENSITY_FADE | RECT_FLAG_SPARSE_EXONS,
    RECT_FLAG_SPARSE_EXONS,
  ])
})
