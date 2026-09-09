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

test('a ramp row draws a gradient bar under its caption, labelled at both ends', () => {
  const { getByText, container } = renderSvg(
    <SvgColorLegend
      canvasWidth={500}
      entries={[
        {
          key: 'contacts',
          label: 'Contacts',
          gradient: {
            stops: [
              { offset: 0, color: 'rgb(255,255,255)', opacity: 0 },
              { offset: 1, color: 'rgb(255,0,0)' },
            ],
            minLabel: '0',
            maxLabel: '1,200',
          },
        },
      ]}
    />,
  )
  expect(getByText('Contacts')).toBeTruthy()
  expect(getByText('0')).toBeTruthy()
  expect(getByText('1,200').getAttribute('text-anchor')).toBe('end')
  const bar = container.querySelector('rect[fill^="url(#"]')!
  const gradient = container.querySelector('linearGradient')!
  expect(bar.getAttribute('fill')).toBe(`url(#${gradient.id})`)
  expect(gradient.querySelectorAll('stop')).toHaveLength(2)
})

test('a two-color row draws both boxes, and every label keeps one column', () => {
  const { getByText, container } = renderSvg(
    <SvgColorLegend
      canvasWidth={500}
      entries={[
        {
          key: 'a',
          label: 'Short insert',
          swatches: [{ color: '#ffc0cb' }, { color: '#ff3a8c' }],
        },
        { key: 'b', label: 'Long insert', color: 'red' },
      ]}
    />,
  )
  // two swatches and one, plus a paper rect per row
  expect(container.querySelectorAll('rect')).toHaveLength(5)
  // the widest row sets the inset for all of them, or the labels stagger
  expect(getByText('Short insert').getAttribute('x')).toBe('28')
  expect(getByText('Long insert').getAttribute('x')).toBe('28')
})

test('a caller may place the box instead of right-aligning it', () => {
  const { container } = renderSvg(
    <SvgColorLegend
      canvasWidth={500}
      x={510}
      entries={[{ key: 'a', label: 'TssA', color: 'red' }]}
    />,
  )
  expect(container.querySelector('g')!.getAttribute('transform')).toBe(
    'translate(510 0)',
  )
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

test('draws nothing with no entries', () => {
  const { container } = renderSvg(
    <SvgColorLegend canvasWidth={500} entries={[]} />,
  )
  expect(container.querySelector('g')).toBeNull()
})

test('a glyph swatch is the point shape drawn as a path, in the row colour', () => {
  const { container } = renderSvg(
    <SvgColorLegend
      canvasWidth={500}
      entries={[
        {
          key: 'tri',
          label: 'INS',
          swatches: [{ color: 'currentColor', glyph: 'triangle' }],
        },
        {
          key: 'dia',
          label: 'DEL',
          swatches: [{ color: 'currentColor', glyph: 'diamond' }],
        },
        {
          key: 'disc',
          label: 'SNV',
          swatches: [{ color: 'currentColor', glyph: 'disc' }],
        },
      ]}
    />,
  )
  const paths = [...container.querySelectorAll('path')].map(p =>
    p.getAttribute('d'),
  )
  // a triangle is three corners, a diamond four, a disc two arcs; every one
  // closes and stays inside its 10px box
  expect(paths[0]).toMatch(/^M[^L]*L[^L]*L[^L]*Z$/)
  expect(paths[1]).toMatch(/^M[^L]*L[^L]*L[^L]*L[^L]*Z$/)
  expect(paths[2]).toMatch(/A/)
  for (const d of paths) {
    const coords = d!.match(/-?\d+(\.\d+)?/g)!.map(Number)
    expect(coords.every(c => c >= 0 && c <= 20)).toBe(true)
  }
  expect(container.querySelectorAll('path[fill="currentColor"]')).toHaveLength(
    3,
  )
})
