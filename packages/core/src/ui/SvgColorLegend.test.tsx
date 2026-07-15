import { cleanup, render } from '@testing-library/react'

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

test('children render inside the positioned box', () => {
  const { getByText } = renderSvg(
    <SvgColorLegend canvasWidth={500} entries={[]}>
      <text>custom footer</text>
    </SvgColorLegend>,
  )
  expect(getByText('custom footer')).toBeTruthy()
})

test('draws nothing with no entries and no children', () => {
  const { container } = renderSvg(
    <SvgColorLegend canvasWidth={500} entries={[]} />,
  )
  expect(container.querySelector('g')).toBeNull()
})
