import { letterSegments } from '@jbrowse/plugin-alignments'

import { segmentMapCaption, segmentMapSvg } from './segmentMapSvg.ts'

import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

function candidate(
  observedSegments: DerivativeCandidate['observedSegments'],
): DerivativeCandidate {
  return {
    observedSegments,
    segments: observedSegments,
    readCount: 29,
    pathId: 'p',
    locString: '',
    refNames: [...new Set(observedSegments.map(s => s.refName))],
    extendsOffScreen: false,
  }
}

const der3 = candidate([
  { refName: 'chr3', start: 25_326_821, end: 25_359_568, strand: 1 },
  { refName: 'chr10', start: 58_717_463, end: 58_717_662, strand: 1 },
  { refName: 'chr12', start: 72_273_111, end: 72_273_294, strand: -1 },
  { refName: 'chr3', start: 25_352_683, end: 25_359_111, strand: -1 },
])

function figure(c: DerivativeCandidate) {
  return segmentMapSvg(c, letterSegments(c.observedSegments), 'reads')
}

test('the caption is the string plus a legend', () => {
  expect(
    segmentMapCaption(der3, letterSegments(der3.observedSegments), 'reads'),
  ).toBe(
    'A B C D E′ B′. A = chr3:25,326,822..25,352,683 (25.9Kbp); B = chr3:25,352,684..25,359,111 (6.43Kbp, ×2); C = chr3:25,359,112..25,359,568 (457bp); D = chr10:58,717,464..58,717,662 (199bp); E = chr12:72,273,112..72,273,294 (183bp). 29 reads.',
  )
})

test('the figure stands alone and carries the string, the copies and the legend', () => {
  const svg = figure(der3)
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  expect(svg.endsWith('</svg>')).toBe(true)
  expect(svg).toContain('A B C D E′ B′')
  // B is carried twice, and the step over the reference says so
  expect(svg).toContain('×2')
  expect(svg).toContain('J1')
  expect(svg).toContain('J3')
  expect(svg).not.toContain('J4')
  expect(svg).toContain('chr10:58,717,464..58,717,662 (199bp)')
  // the narrow inserts still carry their letters in the derivative row
  expect(svg).toContain('>D</text>')
  expect(svg).toContain('>E′</text>')
})

test('a skipped piece is drawn hollow and named as missing', () => {
  const deletion = candidate([
    { refName: 'chr1', start: 1000, end: 2000, strand: 1 },
    { refName: 'chr1', start: 2_000_000, end: 2_001_000, strand: 1 },
  ])
  const svg = figure(deletion)
  expect(svg).toContain('stroke-dasharray')
  expect(svg).toContain('not in derivative')
  // and does not take the figure over: the two arms it separates stay drawn at
  // more than the floor
  const widths = [
    ...svg.matchAll(/<rect x="[\d.]+" y="\d+" width="([\d.]+)"/g),
  ].map(m => Number(m[1]))
  expect(Math.max(...widths)).toBeLessThan(400)
})

test('a refName with markup in it is escaped', () => {
  const svg = figure(
    candidate([
      { refName: 'HLA-A*01:01<x>', start: 0, end: 1000, strand: 1 },
      { refName: 'chr1', start: 0, end: 1000, strand: 1 },
    ]),
  )
  expect(svg).not.toContain('<x>')
  expect(svg).toContain('&lt;x&gt;')
})

const many = candidate(
  Array.from({ length: 60 }, (_, i) => ({
    refName: `chr${i}`,
    start: 0,
    end: 1000,
    strand: 1,
  })),
)

function svgHeight(svg: string) {
  return Number(/<svg [^>]*height="(\d+)"/.exec(svg)![1])
}

test('the height follows the legend', () => {
  const long = figure(many)
  expect(svgHeight(long)).toBeGreaterThan(svgHeight(figure(der3)))
  expect(long).toContain('20 more pieces')
})

test('a route through sixty chromosomes still draws inside the frame', () => {
  // the chromosome gaps alone were wider than the row, and every block came
  // out with a negative width
  const rects = [
    ...figure(many).matchAll(/<rect x="([\d.]+)" y="\d+" width="([\d.]+)"/g),
  ].map(m => [Number(m[1]), Number(m[2])] as const)
  expect(rects).toHaveLength(120)
  for (const [x, width] of rects) {
    expect(width).toBeGreaterThan(0)
    expect(x + width).toBeLessThanOrEqual(720)
  }
})
