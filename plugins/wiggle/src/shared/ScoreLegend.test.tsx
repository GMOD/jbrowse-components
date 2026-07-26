import { render } from '@testing-library/react'

import ScoreLegend from './ScoreLegend.tsx'

function stops(container: HTMLElement) {
  return [...container.querySelectorAll('stop')].map(s => ({
    offset: s.getAttribute('offset'),
    color: s.getAttribute('stop-color'),
  }))
}

const RAMP = { posColor: '#b2182b', negColor: '#2166ac', pivot: 2 }

test('without a ramp it stays the one-line domain text', () => {
  const { container } = render(
    <svg>
      <ScoreLegend domain={[0, 6]} scaleType="linear" canvasWidth={500} />
    </svg>,
  )
  expect(container.textContent).toBe('[0, 6]')
  expect(stops(container)).toHaveLength(0)
})

test('the bar is sampled from the real ramp, so an off-center pivot shows its short side unsaturated', () => {
  const { container } = render(
    <svg>
      <ScoreLegend
        domain={[0, 6]}
        scaleType="linear"
        canvasWidth={500}
        ramp={RAMP}
        gradientId="g1"
      />
    </svg>,
  )
  const s = stops(container)
  // the loss end of a 0..6 domain pivoted at 2 can only reach half saturation,
  // and the legend says so rather than painting a full-strength blue
  expect(s.at(0)).toEqual({ offset: '0', color: 'rgb(144,178,213)' })
  expect(s.at(-1)).toEqual({ offset: '1', color: 'rgb(178,24,43)' })
})

test('a symmetric domain saturates both ends', () => {
  const { container } = render(
    <svg>
      <ScoreLegend
        domain={[0, 4]}
        scaleType="linear"
        canvasWidth={500}
        ramp={RAMP}
        gradientId="g2"
      />
    </svg>,
  )
  const s = stops(container)
  expect(s.at(0)!.color).toBe('rgb(33,102,172)')
  expect(s.at(-1)!.color).toBe('rgb(178,24,43)')
})

test('labels the pivot where it actually falls, not at the middle', () => {
  const { container } = render(
    <svg>
      <ScoreLegend
        domain={[0, 6]}
        scaleType="linear"
        canvasWidth={500}
        ramp={RAMP}
        gradientId="g3"
      />
    </svg>,
  )
  const texts = [...container.querySelectorAll('text')]
  expect(texts.map(t => t.textContent)).toEqual(['0', '2', '6'])
  // pivot 2 of 0..6 sits a third along the 110px bar, not at 55
  const [left, pivot] = texts
  expect(Number(pivot!.getAttribute('x')) - Number(left!.getAttribute('x'))).toBeCloseTo(
    110 / 3,
  )
})
