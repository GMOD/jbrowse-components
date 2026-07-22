import { createOverviewLayout } from '@jbrowse/core/util/Base1DUtils'
import { render } from '@testing-library/react'

import { HEADER_OVERVIEW_HEIGHT } from '../consts.ts'
import Cytobands from './Cytobands.tsx'

import type { Cytoband } from './util.ts'

// hg19 chr1, trimmed to the bands around the centromere
const cytobands: Cytoband[] = [
  { refName: '1', start: 0, end: 121500000, type: 'gneg', name: 'p11.2' },
  {
    refName: '1',
    start: 121500000,
    end: 125000000,
    type: 'acen',
    name: 'p11.1',
  },
  { refName: '1', start: 125000000, end: 128900000, type: 'acen', name: 'q11' },
  { refName: '1', start: 128900000, end: 249250621, type: 'gvar', name: 'q12' },
]

function acenPoints(
  regions: { start: number; end: number; reversed?: boolean }[],
) {
  const displayedRegions = regions.map(r => ({
    assemblyName: 'hg19',
    refName: '1',
    reversed: false,
    ...r,
  }))
  const overview = createOverviewLayout({ displayedRegions, width: 800 })
  return displayedRegions.map((r, displayedRegionIndex) => {
    const { container } = render(
      <svg>
        <Cytobands
          overview={overview}
          cytobands={cytobands}
          block={{
            ...r,
            type: 'ContentBlock',
            key: `${displayedRegionIndex}`,
            displayedRegionIndex,
            offsetPx: 0,
            widthPx: 800,
          }}
        />
      </svg>,
    )
    return [...container.querySelectorAll('polygon')].map(p =>
      describeTriangle(p.getAttribute('points')!),
    )
  })
}

// the apex is the vertex at mid-height; it sits at the triangle's right edge
// when the triangle points right
function describeTriangle(points: string) {
  const [x1, y1, x2, , x3] = points.split(',').map(Number)
  const apex = y1 === HEADER_OVERVIEW_HEIGHT / 2 ? x1! : x2!
  return { apex, dir: apex === Math.max(x1!, x2!, x3!) ? '>' : '<' }
}

test('centromere halves meet at the centromere pointing at each other', () => {
  expect(acenPoints([{ start: 0, end: 249250621 }])).toEqual([
    [
      { apex: 401, dir: '>' },
      { apex: 401, dir: '<' },
    ],
  ])
})

test('centromere halves still point at each other when reversed', () => {
  expect(acenPoints([{ start: 0, end: 249250621, reversed: true }])).toEqual([
    [
      { apex: 399, dir: '<' },
      { apex: 399, dir: '>' },
    ],
  ])
})

test('bands are clipped to their own block, not drawn in every block', () => {
  expect(
    acenPoints([
      { start: 121000000, end: 124000000 },
      { start: 196000000, end: 198000000 },
    ]),
  ).toEqual([[{ apex: 480, dir: '>' }], []])
})
