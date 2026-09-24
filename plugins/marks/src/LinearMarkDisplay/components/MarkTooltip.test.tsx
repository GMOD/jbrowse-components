import { SHAPE_CODES } from '@jbrowse/core/util/shapeNames'
import { render, screen } from '@testing-library/react'

import MarkTooltip from './MarkTooltip.tsx'

import type { FacetLayout } from '../facet.ts'
import type { MarkHitInfo } from '../findMarkHit.ts'
import type { MarkTooltipModel } from './MarkTooltip.tsx'

const at = { x: 10, y: 10, clientX: 10, clientY: 10 }

const NO_FACET: FacetLayout = {
  sections: [],
  rowCount: 0,
  firstRowOf: new Map(),
}

const HIT: MarkHitInfo = {
  markIndex: 0,
  regionIndex: 0,
  instance: 0,
  featureIndex: 0,
  refName: 'ctgA',
  start: 100,
  end: 150,
  y: undefined,
  color: undefined,
  colorValue: undefined,
  glyph: undefined,
  row: undefined,
  screenX: 0,
  screenY: 0,
}

async function tooltip(model: Partial<MarkTooltipModel>) {
  render(
    <MarkTooltip
      model={{
        hoveredFeature: HIT,
        encodings: [{}],
        markTypes: ['bar'],
        legendSections: [],
        facetLayout: NO_FACET,
        coarseTierStandsIn: false,
        ...model,
      }}
      mouseState={at}
    />,
  )
  return await screen.findByRole('tooltip')
}

test('a point reads its shape scale, naming the category the plot drew', async () => {
  const box = await tooltip({
    hoveredFeature: { ...HIT, y: 7, glyph: SHAPE_CODES['triangle-down'] },
    encodings: [
      { y: 'score', shape: { field: 'svtype', scale: 'categorical' } },
    ],
    markTypes: ['point'],
    legendSections: [
      {
        markIndexes: [0],
        channel: 'shape',
        scale: {
          kind: 'shape',
          field: 'svtype',
          domain: [],
          entries: [
            { value: 'DEL', shape: 'triangle-down' },
            { value: 'DUP', shape: 'diamond' },
          ],
        },
        title: 'svtype',
      },
    ],
  })
  expect(box.textContent).toContain('score: 7')
  expect(box.textContent).toContain('svtype: DEL')
  expect(box.textContent).toContain('point')
})

// The sidecar's bins are drawn through the density mark's `y`, but their
// value is the sidecar's level, not that field's.
test('a density sidecar bin names the sidecar, not the field it stands in for', async () => {
  const box = await tooltip({
    hoveredFeature: { ...HIT, y: 17 },
    encodings: [{ y: 'count' }],
    coarseTierStandsIn: true,
  })
  expect(box.textContent).toContain('density sidecar: 17')
  expect(box.textContent).not.toContain('count')
})

test('a span stacked by a transform names the band it stands in', async () => {
  const box = await tooltip({
    hoveredFeature: { ...HIT, color: 0xff123456, row: 2 },
    encodings: [{ row: 'row', color: 'red' }],
    markTypes: ['span'],
  })
  expect(box.textContent).toContain('row: 2')
})

// A mark standing in the facet's or the display's pileup names no row field,
// and its hover still says which section it is in; outside a facet a bare row
// number says nothing.
test('a mark in an implicit pileup names its section', async () => {
  const box = await tooltip({
    hoveredFeature: { ...HIT, color: 0xff123456, row: 3 },
    encodings: [{ color: 'red' }],
    markTypes: ['span'],
    facetLayout: {
      sections: [
        { key: 'DEL', label: 'svtype: DEL', firstRow: 0, rowCount: 2 },
        { key: 'DUP', label: 'svtype: DUP', firstRow: 2, rowCount: 3 },
      ],
      rowCount: 5,
      firstRowOf: new Map([
        ['DEL', 0],
        ['DUP', 2],
      ]),
    },
  })
  expect(box.textContent).toContain('svtype: DUP')
})

test('a mark in an implicit pileup outside a facet shows no bare row number', async () => {
  const box = await tooltip({
    hoveredFeature: { ...HIT, color: 0xff123456, row: 3 },
    encodings: [{ color: 'red' }],
    markTypes: ['span'],
  })
  expect(box.textContent).not.toContain('row')
})

test('under a facet the band reads as the section chip rather than an index', async () => {
  const box = await tooltip({
    hoveredFeature: { ...HIT, color: 0xff123456, row: 3 },
    encodings: [{ row: 'row', color: 'red' }],
    markTypes: ['span'],
    facetLayout: {
      sections: [
        { key: 'DEL', label: 'svtype: DEL', firstRow: 0, rowCount: 2 },
        { key: 'DUP', label: 'svtype: DUP', firstRow: 2, rowCount: 3 },
      ],
      rowCount: 5,
      firstRowOf: new Map([
        ['DEL', 0],
        ['DUP', 2],
      ]),
    },
  })
  expect(box.textContent).toContain('svtype: DUP')
  expect(box.textContent).not.toContain('row: 3')
})

test('a constant colour is a swatch with no field beside it', async () => {
  const box = await tooltip({
    hoveredFeature: { ...HIT, y: 5, color: 0xff0000ff },
    encodings: [{ y: 'score', color: 'red' }],
  })
  expect(box.querySelector('rect')?.getAttribute('fill')).toBe(
    'rgba(255,0,0,1)',
  )
  expect(box.textContent).toContain('score: 5')
  expect(box.textContent).not.toContain('color')
})

test('a jexl channel prints its value under the label jexl', async () => {
  const box = await tooltip({
    hoveredFeature: { ...HIT, y: 14 },
    encodings: [{ y: "jexl:get(feature,'score') * 2" }],
  })
  expect(box.textContent).toContain('jexl: 14')
  expect(box.textContent).not.toContain('get(feature')
})
