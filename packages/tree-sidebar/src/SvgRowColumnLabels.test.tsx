import { render } from '@testing-library/react'

import { RowLabelsOverlay } from './RowLabelsOverlay.tsx'
import { SvgRowColumnLabels } from './SvgRowColumnLabels.tsx'
import { SvgTreeSidebar } from './SvgTreeSidebar.tsx'
import {
  ROW_COLUMN_LABEL_LINE_HEIGHT,
  rowLabelsBoxWidth,
} from './rowLabelsBoxWidth.ts'
import { svgSidebarWidth } from './svgSidebarWidth.ts'

const LINE = ROW_COLUMN_LABEL_LINE_HEIGHT
const names = ['a', 'b', 'c']
const plain = names.map(name => ({ name }))
const colored = names.map(name => ({ name, rowColor: '#f4a582' }))
const population = new Map([['a', '#cc6677']])
const sex = new Map([['b', '#66c2a5']])

function partsOf(container: Element) {
  return {
    labels: [
      ...container.querySelectorAll('[data-testid="row-column-label"]'),
    ].map(text => ({
      text: text.textContent,
      x: Number(text.getAttribute('x')),
      y: Number(text.getAttribute('y')),
      fontSize: Number(text.getAttribute('font-size')),
    })),
    leaders: [
      ...container.querySelectorAll('[data-testid="row-column-leader"]'),
    ].map(path => {
      const [, left, top, tickEnd, right] =
        /^M(\S+) (\S+)H(\S+)v1H(\S+)V0h-1z$/.exec(
          path.getAttribute('d') ?? '',
        ) ?? []
      return {
        x: (Number(left) + Number(right)) / 2,
        width: Number(right) - Number(left),
        y: Number(top) + 0.5,
        tickEnd: Number(tickEnd),
      }
    }),
  }
}

function draw(props: Parameters<typeof SvgRowColumnLabels>[0]) {
  return render(
    <svg>
      <SvgRowColumnLabels {...props} />
    </svg>,
  ).container
}

describe('SvgRowColumnLabels', () => {
  it('draws nothing without labels', () => {
    const c = draw({
      labels: [],
      sources: colored,
      rowHeight: 20,
      labelOffset: 0,
      annotations: [population],
    })
    expect(c.querySelector('g')).toBeNull()
  })

  it('stacks a line per column above the first row, the first column on top', () => {
    const { labels } = partsOf(
      draw({
        labels: ['Superpopulation', 'Population', 'Sex'],
        sources: colored,
        rowHeight: 20,
        labelOffset: 0,
        annotations: [population, sex],
      }),
    )
    expect(labels.map(label => label.text)).toEqual([
      'Superpopulation',
      'Population',
      'Sex',
    ])
    expect(labels.map(label => label.y)).toEqual([
      -2.5 * LINE,
      -1.5 * LINE,
      -0.5 * LINE,
    ])
  })

  it("drops a 1px leader to each column's center beside the names", () => {
    const { labels, leaders } = partsOf(
      draw({
        labels: ['Superpopulation', 'Population', 'Sex'],
        sources: colored,
        rowHeight: 20,
        labelOffset: 0,
        annotations: [population, sex],
      }),
    )
    expect(leaders.map(leader => leader.x)).toEqual([2, 6, 10])
    expect(leaders.map(leader => leader.width)).toEqual([1, 1, 1])
    expect(leaders.map(leader => leader.y)).toEqual(labels.map(l => l.y))
    const textX = new Set(labels.map(label => label.x))
    expect(textX.size).toBe(1)
    const [x] = [...textX]
    expect(x).toBeGreaterThan(Math.max(...leaders.map(leader => leader.x)))
    expect(Math.max(...leaders.map(leader => leader.tickEnd))).toBeLessThan(x!)
  })

  it('centers the leaders on the 8px swatch and the 4px columns at a sub-pixel row', () => {
    const { leaders } = partsOf(
      draw({
        labels: ['Superpopulation', 'Population', 'Sex'],
        sources: colored,
        rowHeight: 0.32,
        labelOffset: 0,
        annotations: [population, sex],
      }),
    )
    expect(leaders.map(leader => leader.x)).toEqual([4, 10, 14])
  })

  it('starts at the first annotation where no row has a color', () => {
    const { leaders } = partsOf(
      draw({
        labels: ['Population', 'Sex'],
        sources: plain,
        rowHeight: 20,
        labelOffset: 30,
        annotations: [population, sex],
      }),
    )
    expect(leaders.map(leader => leader.x)).toEqual([2, 6])
  })

  it("takes the export's text size up to its line, and swallows no pointer", () => {
    const props = {
      labels: ['Population', 'Sex'],
      sources: plain,
      rowHeight: 20,
      labelOffset: 30,
      annotations: [population, sex],
    }
    const size = (c: Element) => partsOf(c).labels[0]!.fontSize
    expect(size(draw(props))).toBe(LINE)
    expect(size(draw({ ...props, text: { fontSize: 8 } }))).toBe(8)
    expect(size(draw({ ...props, text: { fontSize: 30 } }))).toBe(LINE)
    const group = draw(props).querySelector('g')!
    expect(group.getAttribute('transform')).toBe('translate(30 0)')
    expect(group.style.pointerEvents).toBe('none')
  })
})

describe('the column labels on screen and in the export', () => {
  const labels = ['Superpopulation', 'Population', 'Sex']
  const annotations = [population, sex]

  it.each([20, 0.32])(
    'draws the same labels above the rows at a %fpx row',
    rowHeight => {
      const screen = render(
        <RowLabelsOverlay
          sources={colored}
          rowHeight={rowHeight}
          labelOffset={0}
          width={400}
          height={200}
          top={90}
          testId="labels"
          annotations={annotations}
          columnLabels={labels}
        />,
      )
      const band = screen.getByTestId('row-column-labels')
      expect(band.style.top).toBe(`${90 - 3 * LINE}px`)
      expect(band.style.height).toBe(`${3 * LINE}px`)
      expect(band.style.pointerEvents).toBe('none')
      expect(band.querySelector('g')!.getAttribute('transform')).toBe(
        `translate(0 ${3 * LINE})`,
      )
      expect(
        screen
          .getByTestId('labels')
          .querySelector('[data-testid="row-column-label"]'),
      ).toBeNull()
      const sidebar = {
        showTree: false,
        hierarchy: undefined,
        sources: colored,
        rowHeight,
        treeAreaWidth: 0,
        annotations,
        columnLabels: labels,
      }
      const exported = render(
        <svg>
          <SvgTreeSidebar
            sidebar={sidebar}
            availableHeight={100}
            clipId="display"
          />
        </svg>,
      ).container
      expect(partsOf(exported)).toEqual(partsOf(band))
      expect(partsOf(exported).labels).toHaveLength(3)
      expect(
        exported.querySelector('g[clip-path] [data-testid="row-column-label"]'),
      ).toBeNull()
      expect(svgSidebarWidth(sidebar)).toBe(
        rowLabelsBoxWidth(colored, rowHeight, undefined, annotations),
      )
      expect(svgSidebarWidth(sidebar)).toBe(
        svgSidebarWidth({ ...sidebar, columnLabels: [] }),
      )
    },
  )

  it('draws no label band without labels, or with the row labels hidden', () => {
    const overlay = (columnLabels: string[], showLabels: boolean) =>
      render(
        <RowLabelsOverlay
          sources={colored}
          rowHeight={20}
          labelOffset={0}
          width={400}
          height={200}
          annotations={annotations}
          columnLabels={columnLabels}
          showLabels={showLabels}
        />,
      ).queryByTestId('row-column-labels')
    expect(overlay([], true)).toBeNull()
    expect(overlay(labels, false)).toBeNull()
    expect(overlay(labels, true)).not.toBeNull()
    const hidden = render(
      <svg>
        <SvgTreeSidebar
          sidebar={{
            showTree: false,
            hierarchy: undefined,
            sources: colored,
            rowHeight: 20,
            treeAreaWidth: 0,
            annotations,
            columnLabels: labels,
            showLabels: false,
          }}
        />
      </svg>,
    ).container
    expect(partsOf(hidden).labels).toEqual([])
  })
})
