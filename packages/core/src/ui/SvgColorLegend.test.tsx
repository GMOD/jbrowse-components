import { cleanup, fireEvent, render } from '@testing-library/react'

import SvgColorLegend from './SvgColorLegend.tsx'

afterEach(cleanup)

function renderSvg(node: React.ReactNode) {
  return render(<svg>{node}</svg>)
}

test('renders a labeled swatch row per entry', () => {
  const { getByText, container } = renderSvg(
    <SvgColorLegend
      canvasWidth={500}
      entries={[
        { key: 'a', label: 'TssA', color: 'red' },
        { key: 'b', label: 'Quies', color: 'green' },
      ]}
    />,
  )
  expect(getByText('TssA')).toBeTruthy()
  expect(getByText('Quies')).toBeTruthy()
  // paper + swatch per row
  expect(container.querySelectorAll('rect')).toHaveLength(4)
})

test('hidden entries dim and strike through', () => {
  const { getByText, container } = renderSvg(
    <SvgColorLegend
      canvasWidth={500}
      entries={[{ key: 'a', label: 'TssA', color: 'red', hidden: true }]}
    />,
  )
  expect(getByText('TssA').getAttribute('text-decoration')).toBe('line-through')
  expect(container.querySelector('g[opacity="0.35"]')).toBeTruthy()
})

test('a custom marker replaces the default color square', () => {
  const { getByTestId, container } = renderSvg(
    <SvgColorLegend
      canvasWidth={500}
      entries={[
        {
          key: 'a',
          label: 'coverage',
          marker: <line data-testid="marker" x1={2} y1={7} x2={12} y2={7} />,
        },
      ]}
    />,
  )
  expect(getByTestId('marker')).toBeTruthy()
  // only the paper rect remains; no swatch rect drawn for a markered/colorless row
  expect(container.querySelectorAll('rect')).toHaveLength(1)
})

// A key for a display that draws connectors as well as bodies has to say which
// is which; a square for both says a color exists but not what to look for.
test('a connector color draws as the curve it is, not as a square', () => {
  const { container } = renderSvg(
    <SvgColorLegend
      canvasWidth={500}
      entries={[
        {
          key: 'a',
          label: 'Long insert',
          color: 'red',
          swatches: [{ color: 'red', mark: 'curve' }],
        },
      ]}
    />,
  )
  expect(container.querySelectorAll('path')).toHaveLength(1)
  // the paper rect alone — the swatch is no longer one
  expect(container.querySelectorAll('rect')).toHaveLength(1)
})

test('a two-mark row draws both, and every label keeps one column', () => {
  const { getByText, container } = renderSvg(
    <SvgColorLegend
      canvasWidth={500}
      entries={[
        {
          key: 'a',
          label: 'Short insert',
          swatches: [{ color: '#ffc0cb' }, { color: '#ff3a8c', mark: 'curve' }],
        },
        { key: 'b', label: 'Long insert', color: 'red' },
      ]}
    />,
  )
  // fill + paper + paper, and the arc
  expect(container.querySelectorAll('path')).toHaveLength(1)
  // the widest row sets the inset for all of them, or the labels stagger
  expect(getByText('Short insert').getAttribute('x')).toBe('28')
  expect(getByText('Long insert').getAttribute('x')).toBe('28')
})

// A scheme whose fill is a ramp (alignments' insert-size gradient) keys the ramp
// rather than its endpoint, which only the most extreme features paint.
test('a ramp swatch fills from its own defs, not a flat color', () => {
  const { container } = renderSvg(
    <SvgColorLegend
      canvasWidth={500}
      entries={[
        {
          key: 'a',
          label: 'Long insert',
          color: 'red',
          swatches: [{ color: 'red', gradient: ['grey', 'red'] }],
        },
      ]}
    />,
  )
  const stops = container.querySelectorAll('linearGradient stop')
  expect([...stops].map(s => s.getAttribute('offset'))).toEqual(['0%', '100%'])
  // the swatch points at the gradient it just defined, rather than at `color`
  const id = container.querySelector('linearGradient')!.getAttribute('id')
  const swatch = [...container.querySelectorAll('rect')].find(
    r => r.getAttribute('fill') !== 'rgba(255,255,255,0.95)',
  )
  expect(swatch!.getAttribute('fill')).toBe(`url(#${id})`)
})

// The id has to survive being pointed at by url(#...), and two DIFFERENT ramps
// must not collide onto one — the second would silently paint the first's colors.
test('ramp ids are url-safe and distinct per ramp', () => {
  const { container } = renderSvg(
    <SvgColorLegend
      canvasWidth={500}
      entries={[
        {
          key: 'a',
          label: 'Long',
          color: 'a',
          swatches: [{ color: 'a', gradient: ['rgb(1,2,3)', 'rgb(4,5,6)'] }],
        },
        {
          key: 'b',
          label: 'Short',
          color: 'b',
          swatches: [{ color: 'b', gradient: ['rgb(1,2,3)', 'rgb(7,8,9)'] }],
        },
      ]}
    />,
  )
  const ids = [...container.querySelectorAll('linearGradient')].map(g =>
    g.getAttribute('id'),
  )
  expect(new Set(ids).size).toBe(2)
  // no whitespace, parens or commas, which an unquoted url() cannot carry
  for (const id of ids) {
    expect(id).toMatch(/^[\w.:~-]+$/)
  }
})

test('children render inside the positioned box', () => {
  const { getByText } = renderSvg(
    <SvgColorLegend canvasWidth={500} entries={[]}>
      <text>custom footer</text>
    </SvgColorLegend>,
  )
  expect(getByText('custom footer')).toBeTruthy()
})

test('maxHeight collapses overflow into a "+N more" row and never exceeds it', () => {
  const entries = Array.from({ length: 10 }, (_, i) => ({
    key: `k${i}`,
    label: `cat${i}`,
    color: 'red',
  }))
  // room for 4 rows (4 * 14 = 56) -> 3 entries shown + a "+7 more" summary
  const { getByText, queryByText, container } = renderSvg(
    <SvgColorLegend canvasWidth={500} maxHeight={56} entries={entries} />,
  )
  expect(getByText('cat0')).toBeTruthy()
  expect(getByText('cat2')).toBeTruthy()
  expect(queryByText('cat3')).toBeNull()
  expect(getByText('+7 more')).toBeTruthy()
  // capped at 4 rows: 3 category labels + the summary, never the full 10
  expect(container.querySelectorAll('text')).toHaveLength(4)
})

test('onDismiss adds an "×" button that fires on click', () => {
  const onDismiss = jest.fn()
  const { getByText } = renderSvg(
    <SvgColorLegend
      canvasWidth={500}
      entries={[{ key: 'a', label: 'TssA', color: 'red' }]}
      onDismiss={onDismiss}
    />,
  )
  fireEvent.click(getByText('×'))
  expect(onDismiss).toHaveBeenCalledTimes(1)
})

test('no dismiss button without onDismiss (e.g. the SVG export)', () => {
  const { queryByText } = renderSvg(
    <SvgColorLegend
      canvasWidth={500}
      entries={[{ key: 'a', label: 'TssA', color: 'red' }]}
    />,
  )
  expect(queryByText('×')).toBeNull()
})

test('draws nothing with no entries and no children', () => {
  const { container } = renderSvg(
    <SvgColorLegend canvasWidth={500} entries={[]} />,
  )
  expect(container.querySelector('g')).toBeNull()
})
