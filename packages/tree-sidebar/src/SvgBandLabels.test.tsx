import { render } from '@testing-library/react'

import { RowLabelsOverlay } from './RowLabelsOverlay.tsx'
import { BAND_LABEL_WIDTH } from './SvgBandLabels.tsx'
import { SvgTreeSidebar } from './SvgTreeSidebar.tsx'

const sources = ['a', 'b', 'c', 'd'].map(name => ({ name }))

// AFR's three rows hold its name; EUR's one row is too short to.
const bands = [
  { key: 'AFR', label: 'AFR', start: 0, end: 3 },
  { key: 'EUR', label: 'EUR', start: 3, end: 4 },
]

function exported(showLabels = true) {
  const { container } = render(
    <svg>
      <SvgTreeSidebar
        showTree
        hierarchy={undefined}
        sources={sources}
        rowHeight={20}
        treeAreaWidth={80}
        showLabels={showLabels}
        bands={bands}
      />
    </svg>,
  )
  return container
}

function onScreen(showLabels = true) {
  const { getByTestId } = render(
    <RowLabelsOverlay
      sources={sources}
      rowHeight={20}
      labelOffset={0}
      width={400}
      height={80}
      testId="labels"
      showLabels={showLabels}
      bands={bands}
    />,
  )
  return getByTestId('labels')
}

const bandTexts = (root: Element) =>
  [...root.querySelectorAll('[data-testid="row_band_labels"] text')].map(
    t => t.textContent,
  )

describe.each([
  ['the SVG export', exported],
  ['the screen', onScreen],
])('band labels in %s', (_, draw) => {
  test('a band tall enough holds its name, a short one is culled', () => {
    expect(bandTexts(draw())).toEqual(['AFR'])
  })

  test('a hairline where one band meets the next', () => {
    const lines = draw().querySelectorAll(
      '[data-testid="row_band_labels"] line',
    )
    expect([...lines].map(l => l.getAttribute('y1'))).toEqual(['60'])
  })

  test('the row labels sit beside the strip', () => {
    const shifted = [...draw().querySelectorAll('g[transform]')].map(g =>
      g.getAttribute('transform'),
    )
    expect(shifted).toContain(`translate(${BAND_LABEL_WIDTH} 0)`)
  })

  test('the strip stays when the row labels are off', () => {
    const root = draw(false)
    expect(bandTexts(root)).toEqual(['AFR'])
    expect(root.textContent).toBe('AFR')
  })
})
