import { render, screen } from '@testing-library/react'

import { RegionSeams, Scalebar } from './regions.tsx'

test('one span per padding span, in a layer translated into the viewport', () => {
  const { container } = render(
    <RegionSeams
      view={{
        staticBlocksTranslateX: -120.5,
        paddingSpans: [
          { key: 'before', x: 0, width: 50, kind: 'boundary' },
          { key: 'a-sep', x: 349, width: 3, kind: 'seam' },
          { key: 'tiny', x: 352, width: 1, kind: 'elided' },
        ],
      }}
    />,
  )
  const layer = container.querySelector<HTMLElement>('[data-region-seams]')!
  expect(layer.style.transform).toBe('translateX(-120.5px)')
  expect(Number(layer.style.zIndex)).toBe(2)
  const spans = [...layer.children] as HTMLElement[]
  expect(spans.map(s => [s.dataset.span, s.style.left, s.style.width])).toEqual(
    [
      ['boundary', '0px', '50px'],
      ['seam', '349px', '3px'],
      ['elided', '352px', '1px'],
    ],
  )
})

test('a scalebar draws the coordinate labels and region names, and owns its gestures', () => {
  render(
    <Scalebar
      data-testid="scalebar"
      view={{
        staticBlocks: { totalWidthPx: 800 },
        staticBlocksTranslateX: -10.6,
        scalebarLabels: [
          { x: 100, label: '43,050,000' },
          { x: 300, label: '43,060,000' },
        ],
        scalebarRefNameLabels: {
          labels: [
            {
              key: 'chr17',
              text: 'chr17',
              transform: 0,
              maxWidth: 200,
              paddingLeft: 7,
            },
          ],
        },
      }}
    />,
  )
  const row = screen.getByTestId('scalebar')
  expect(row.dataset.gestureOwner).toBe('true')
  expect(row.textContent).toBe('43,050,00043,060,000chr17')
  const ticks = row.firstElementChild as HTMLElement
  expect(ticks.style.transform).toBe('translateX(-11px)')
  expect(screen.getByText('chr17').style.maxWidth).toBe('200px')
})
