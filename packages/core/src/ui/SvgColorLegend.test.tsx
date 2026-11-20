import { cleanup, render } from '@testing-library/react'

import { ExportFontFamilyContext } from '../svg/constants.ts'
import { serializeSvg } from '../svg/serializeSvg.ts'
import SvgColorLegend, { svgColorLegendWidth } from './SvgColorLegend.tsx'

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
            maxLabel: '1200',
          },
        },
      ]}
    />,
  )
  expect(getByText('Contacts')).toBeTruthy()
  expect(getByText('0')).toBeTruthy()
  expect(getByText('1200').getAttribute('text-anchor')).toBe('end')
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

test('"+N more" counts the colors cut, and no heading is left over none', () => {
  const entries = [
    { key: 'a-0', label: 'DEL', color: 'red' },
    { key: 'a-1', label: 'DUP', color: 'blue' },
    { key: 'b-title', label: 'Population' },
    { key: 'b-note', label: 'from the samples file' },
    { key: 'b-0', label: 'AFR', color: 'green' },
    { key: 'b-1', label: 'EUR', color: 'orange' },
  ]
  // room for 4 rows: the two SV rows, then the cut lands inside the second
  // section, whose title and note would otherwise hang over nothing
  const { getByText, queryByText } = renderSvg(
    <SvgColorLegend canvasWidth={500} maxHeight={56} entries={entries} />,
  )
  expect(getByText('DUP')).toBeTruthy()
  expect(queryByText('Population')).toBeNull()
  expect(queryByText('from the samples file')).toBeNull()
  expect(getByText('+2 more')).toBeTruthy()
})

test('draws nothing with no entries', () => {
  const { container } = renderSvg(
    <SvgColorLegend canvasWidth={500} entries={[]} />,
  )
  expect(container.querySelector('g')).toBeNull()
})

test('a shape swatch is the point shape drawn as a path, in the row color', () => {
  const { container } = renderSvg(
    <SvgColorLegend
      canvasWidth={500}
      entries={[
        {
          key: 'tri',
          label: 'INS',
          swatches: [{ color: 'currentColor', shape: 'triangle-down' }],
        },
        {
          key: 'dia',
          label: 'DEL',
          swatches: [{ color: 'currentColor', shape: 'diamond' }],
        },
        {
          key: 'circle',
          label: 'SNV',
          swatches: [{ color: 'currentColor', shape: 'circle' }],
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

// DejaVu Sans Mono and Courier advance every glyph 0.6em, where the Helvetica
// table has `i` at 0.22em
const MONOSPACE_ADVANCE_EM = 0.6

test('an export in monospace sizes the paper to its labels in that face', () => {
  const label = 'iiiiiiiiiiii'
  const entries = [{ key: 'a', label, color: 'red' }]
  const { getByText, container } = renderSvg(
    <ExportFontFamilyContext value="monospace">
      <SvgColorLegend canvasWidth={500} x={0} entries={entries} />
    </ExportFontFamilyContext>,
  )
  const paper = Number(container.querySelector('rect')!.getAttribute('width'))
  const textLeft = Number(getByText(label).getAttribute('x'))
  expect(paper).toBeGreaterThan(
    textLeft + label.length * MONOSPACE_ADVANCE_EM * 10,
  )
  expect(svgColorLegendWidth(entries, undefined, 'monospace')).toBe(paper)
})

test('a key with no room for its first row draws nothing and reserves nothing', () => {
  const entries = [
    { key: 'a', label: 'TssA', color: 'red' },
    { key: 'b', label: 'Quies', color: 'green' },
  ]
  const { container } = renderSvg(
    <SvgColorLegend canvasWidth={500} maxHeight={20} entries={entries} />,
  )
  expect(container.querySelector('rect')).toBeNull()
  expect(svgColorLegendWidth(entries, 20)).toBe(0)
})

test('a ramp stop carries its color and opacity as attributes, so an alpha splits out', () => {
  const svg = serializeSvg(
    <svg>
      <SvgColorLegend
        canvasWidth={500}
        idPrefix="k"
        entries={[
          {
            key: 'ramp',
            label: 'Ramp',
            gradient: {
              stops: [
                { offset: 0, color: 'rgba(255,0,0,0.5)' },
                { offset: 1, color: 'rgb(0,0,255)', opacity: 0.25 },
              ],
              minLabel: '0',
              maxLabel: '1',
            },
          },
        ]}
      />
    </svg>,
  )
  const stops = [...svg.matchAll(/<stop[^>]*>/g)].map(([tag]) => tag)
  expect(stops).toHaveLength(2)
  expect(stops[0]).not.toMatch(/rgba|style=/)
  expect(stops[0]).toMatch(/stop-opacity="0.5"/)
  expect(stops[1]).toMatch(/stop-opacity="0.25"/)
})
