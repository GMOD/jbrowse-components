import { TEXT_BASELINE_RATIO } from '@jbrowse/display-ui'
import { render } from '@testing-library/react'

import { RowLabelsOverlay } from './RowLabelsOverlay.tsx'
import { bandLabelWidth } from './SvgBandLabels.tsx'
import { SvgTreeSidebar } from './SvgTreeSidebar.tsx'
import { fittedLabel } from './fittedLabel.ts'

const rows = ['a', 'b', 'c', 'd'].map(name => ({ name }))

// AFR's three rows hold its name; EUR's one row holds only a cut of it.
const bands = [
  { key: 'AFR', label: 'AFR', start: 0, end: 3 },
  { key: 'EUR', label: 'EUR', start: 3, end: 4 },
]

function exported(showLabels = true) {
  const { container } = render(
    <svg>
      <SvgTreeSidebar
        sidebar={{
          showTree: true,
          hierarchy: undefined,
          rows,
          rowHeight: 20,
          treeAreaWidth: 80,
          showLabels,
          bands,
        }}
      />
    </svg>,
  )
  return container
}

function onScreen(showLabels = true) {
  const { getByTestId } = render(
    <RowLabelsOverlay
      rows={rows}
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
  test('a band tall enough holds its name, a short one a cut of it', () => {
    expect(bandTexts(draw())).toEqual(['AFR', 'E…'])
  })

  test('every band names itself whole on hover', () => {
    const titles = draw().querySelectorAll(
      '[data-testid="row_band_labels"] title',
    )
    expect([...titles].map(t => t.textContent)).toEqual(['AFR', 'EUR'])
  })

  test('no line marks where one band meets the next', () => {
    expect(
      draw().querySelectorAll('[data-testid="row_band_labels"] line'),
    ).toHaveLength(0)
  })

  test('the row labels sit beside the strip', () => {
    const shifted = [...draw().querySelectorAll('g[transform]')].map(g =>
      g.getAttribute('transform'),
    )
    expect(shifted).toContain(`translate(${bandLabelWidth()} 0)`)
  })

  test('the strip stays when the row labels are off', () => {
    const root = draw(false)
    expect(bandTexts(root)).toEqual(['AFR', 'E…'])
    expect(root.textContent).not.toMatch(/[a-d]/)
  })
})

// `dominant-baseline` is ignored by Skia and ImageMagick, which then sit the
// name a third of an em off its strip. The baseline is written into `y`, and
// the rotation turns that offset across the strip with the text.
test("each band's name centres on its strip by its own baseline", () => {
  const texts = exported().querySelectorAll(
    '[data-testid="row_band_labels"] text',
  )
  for (const text of texts) {
    const [, mid, cy] = /rotate\(-90 (\S+) (\S+)\)/
      .exec(text.getAttribute('transform')!)!
      .map(Number)
    const fontSize = Number(text.getAttribute('font-size'))
    expect(text.getAttribute('dominant-baseline')).toBeNull()
    expect(Number(text.getAttribute('x'))).toBe(mid)
    expect(Number(text.getAttribute('y')) - cy!).toBeCloseTo(
      fontSize * (TEXT_BASELINE_RATIO - 0.5),
    )
  }
  expect(texts).toHaveLength(2)
})

test('a label cuts to the longest prefix that fits, or to nothing', () => {
  expect(fittedLabel('Parents', 100, 11)).toBe('Parents')
  expect(fittedLabel('Parents', 22, 11)).toBe('Pa…')
  expect(fittedLabel('(no group)', 36, 11)).toBe('(no gr…')
  expect(fittedLabel('EUR', 5, 11)).toBe('')
})
