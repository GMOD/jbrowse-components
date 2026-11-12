import { createTestSession } from '@jbrowse/web/testUtils'
import { render } from '@testing-library/react'

import SVGRegionSeparators from './SVGRegionSeparators.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function exportedSeams(offsetPx: number) {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 4000 },
            { assemblyName: 'volvox', refName: 'ctgA', start: 5000, end: 5010 },
            {
              assemblyName: 'volvox',
              refName: 'ctgA',
              start: 9000,
              end: 13000,
            },
          ],
          tracks: [],
        },
      ],
    },
  }) as any
  const model = session.views[0]
  model.setWidth(300)
  model.setNewView(1, offsetPx)
  const { container } = render(
    <svg>
      <SVGRegionSeparators model={model} height={10} />
    </svg>,
  )
  return [...container.querySelectorAll('rect')].map(rect => [
    Number(rect.getAttribute('x')),
    Number(rect.getAttribute('width')),
  ])
}

test('a narrow region whole in the viewport takes hairline seams', () => {
  expect(exportedSeams(3800)).toEqual([
    [199, 1],
    [209, 1],
  ])
})

test('a narrow region cut by the left edge keeps its hairline seam', () => {
  expect(exportedSeams(4005)).toEqual([[4, 1]])
})

test('a narrow region cut by the right edge keeps the hairline before it', () => {
  expect(exportedSeams(3705)).toEqual([[294, 1]])
})

test('a seam past either edge of the viewport is not drawn', () => {
  expect(exportedSeams(3500)).toEqual([])
  expect(exportedSeams(4020)).toEqual([])
})
