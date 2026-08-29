import { render } from '@testing-library/react'

import ScoreLegend from './ScoreLegend.tsx'

function stops(container: HTMLElement) {
  return [...container.querySelectorAll('stop')].map(s => ({
    offset: s.getAttribute('offset'),
    color: s.getAttribute('stop-color'),
  }))
}

const RAMP = {
  posColor: '#b2182b',
  negColor: '#2166ac',
  pivot: 2,
  rampLut: null,
  gradientId: 'g1',
}

function renderLegend(
  props: Partial<Parameters<typeof ScoreLegend>[0]> & {
    domain: [number, number]
  },
) {
  return render(
    <svg>
      <ScoreLegend
        scaleType="linear"
        symlogConstant={1}
        canvasWidth={500}
        {...props}
      />
    </svg>,
  )
}

test('without a ramp it stays the one-line domain text', () => {
  const { container } = renderLegend({ domain: [0, 6] })
  expect(container.textContent).toBe('[0, 6]')
  expect(stops(container)).toHaveLength(0)
})

test('the bar is sampled from the real ramp, so an off-center pivot shows its short side unsaturated', () => {
  const { container } = renderLegend({ domain: [0, 6], ramp: RAMP })
  const s = stops(container)
  // the loss end of a 0..6 domain pivoted at 2 can only reach half saturation,
  // and the legend says so rather than painting a full-strength blue
  expect(s.at(0)).toEqual({ offset: '0', color: 'rgb(144,178,213)' })
  expect(s.at(-1)).toEqual({ offset: '1', color: 'rgb(178,24,43)' })
})

test('a symmetric domain saturates both ends', () => {
  const { container } = renderLegend({ domain: [0, 4], ramp: RAMP })
  const s = stops(container)
  expect(s.at(0)!.color).toBe('rgb(33,102,172)')
  expect(s.at(-1)!.color).toBe('rgb(178,24,43)')
})

test('labels the pivot where it actually falls, not at the middle', () => {
  const { container } = renderLegend({ domain: [0, 6], ramp: RAMP })
  const texts = [...container.querySelectorAll('text')]
  expect(texts.map(t => t.textContent)).toEqual(['0', '2', '6'])
  // pivot 2 of 0..6 sits a third along the 110px bar, not at 55
  const [left, pivot] = texts
  expect(
    Number(pivot!.getAttribute('x')) - Number(left!.getAttribute('x')),
  ).toBeCloseTo(110 / 3)
})

test('a CSS color the picker writes is parsed, not read as hex', () => {
  const { container } = renderLegend({
    domain: [0, 4],
    ramp: { ...RAMP, posColor: 'rgb(178, 24, 43)' },
  })
  expect(stops(container).at(-1)!.color).toBe('rgb(178,24,43)')
})

// all-positive data pivoted at 0 (the default), where the pivot lands on the
// min end and a second label there would just overprint the first
test('a pivot on a domain edge gets no label of its own', () => {
  const { container } = renderLegend({
    domain: [0, 100],
    ramp: { ...RAMP, pivot: 0 },
  })
  expect(
    [...container.querySelectorAll('text')].map(t => t.textContent),
  ).toEqual(['0', '100'])
  expect(container.querySelectorAll('line')).toHaveLength(0)
})

test('a pivot outside the domain is neither labeled nor ticked', () => {
  const { container } = renderLegend({
    domain: [0, 100],
    ramp: { ...RAMP, pivot: 500 },
  })
  expect(
    [...container.querySelectorAll('text')].map(t => t.textContent),
  ).toEqual(['0', '100'])
  expect(container.querySelectorAll('line')).toHaveLength(0)
})

// an all-zero region autoscales to [0, 0]; dividing by its span used to put
// NaN in the pivot label's x
test('a degenerate domain still renders finite coordinates', () => {
  const { container } = renderLegend({ domain: [0, 0], ramp: RAMP })
  for (const el of container.querySelectorAll('text, rect, line')) {
    for (const attr of ['x', 'x1', 'x2', 'width']) {
      const v = el.getAttribute(attr)
      expect(v === null || Number.isFinite(Number(v))).toBe(true)
    }
  }
})
