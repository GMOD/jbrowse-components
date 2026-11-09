import { render } from '@testing-library/react'

import { RowLabelsOverlay } from './RowLabelsOverlay.tsx'
import { SvgRowLabels } from './SvgRowLabels.tsx'
import { SvgTreeSidebar } from './SvgTreeSidebar.tsx'
import { ROW_COLOR_BAR_WIDTH, rowLabelsBoxWidth } from './rowLabelsBoxWidth.ts'
import { svgSidebarWidth } from './svgSidebarWidth.ts'

const ROW_LABEL_MAX_TEXT_WIDTH = 120

function draw(props: Parameters<typeof SvgRowLabels>[0]) {
  const { container } = render(
    <svg>
      <SvgRowLabels {...props} />
    </svg>,
  )
  return container
}

const wolf = '#67001f'
const dog = '#f4a582'

describe('SvgRowLabels', () => {
  it("draws a row's color as a 4px bar at its label's left, the text past it", () => {
    const sources = [{ name: 'COLL000001', label: 'Collie 1', rowColor: dog }]
    const c = draw({ sources, rowHeight: 20, labelOffset: 0, backdrop: 'wash' })
    const bars = c.querySelectorAll('[data-testid="row-color-bar"]')
    expect(bars).toHaveLength(1)
    const bar = bars[0]!
    expect(ROW_COLOR_BAR_WIDTH).toBe(4)
    expect(bar.getAttribute('fill')).toBe(dog)
    expect(bar.getAttribute('x')).toBe('0')
    expect(bar.getAttribute('width')).toBe('4')
    expect(bar.getAttribute('height')).toBe('20')
    expect(bar.getAttribute('y')).toBe('0')
    const text = c.querySelector('text')!
    expect(text.textContent).toBe('Collie 1')
    expect(Number(text.getAttribute('x'))).toBeGreaterThan(4)
    expect(text.getAttribute('fill')).not.toBe(dog)
    const w = rowLabelsBoxWidth(sources, 20)
    expect(w).toBe(rowLabelsBoxWidth([{ name: 'Collie 1' }], 20) + 4)
    expect(c.querySelector('path')?.getAttribute('d')).toContain(`h${w}`)
  })

  it('draws no bar for a row with no color, beside one that has one', () => {
    const c = draw({
      sources: [{ name: 'a', rowColor: wolf }, { name: 'b' }],
      rowHeight: 20,
      labelOffset: 0,
    })
    const bars = c.querySelectorAll('[data-testid="row-color-bar"]')
    expect(bars).toHaveLength(1)
    expect(bars[0]!.getAttribute('y')).toBe('0')
    expect(bars[0]!.getAttribute('height')).toBe('20')
    const [a, b] = [...c.querySelectorAll('text')]
    expect(a!.getAttribute('x')).toBe(b!.getAttribute('x'))
  })

  it('draws no bar, and starts the text at the box edge, when no row has a color', () => {
    const c = draw({
      sources: [{ name: 'a' }, { name: 'b' }],
      rowHeight: 20,
      labelOffset: 0,
    })
    expect(c.querySelectorAll('rect')).toHaveLength(0)
    expect(c.querySelector('text')?.getAttribute('x')).toBe('4')
  })

  it('boxes each label to its whole row, with a separator between rows', () => {
    const sources = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    const c = draw({ sources, rowHeight: 40, labelOffset: 0, backdrop: 'wash' })
    const w = rowLabelsBoxWidth(sources, 40)
    expect(c.querySelector('path')?.getAttribute('d')).toBe(
      [0, 40, 80].map(y => `M0 ${y}h${w}v40h${-w}z`).join(''),
    )
    const paths = [...c.querySelectorAll('path')].map(p => p.getAttribute('d'))
    expect(paths).toContain(`M0 40h${w}v1h${-w}zM0 80h${w}v1h${-w}z`)
    expect(c.querySelectorAll('rect')).toHaveLength(0)
  })

  it('draws no box without a backdrop, as the export beside its plot does', () => {
    const sources = [{ name: 'a' }, { name: 'b' }]
    const bare = draw({ sources, rowHeight: 40, labelOffset: 0 })
    expect(bare.querySelectorAll('path')).toHaveLength(0)
    expect(bare.querySelectorAll('text')).toHaveLength(2)
    const paper = draw({
      sources,
      rowHeight: 40,
      labelOffset: 0,
      backdrop: 'paper',
    })
    expect(paper.querySelectorAll('path')).toHaveLength(2)
    const wash = draw({
      sources,
      rowHeight: 40,
      labelOffset: 0,
      backdrop: 'wash',
    })
    expect(wash.querySelectorAll('path')).toHaveLength(3)
  })

  it('fills the label run with the color, and draws no text, below the text threshold', () => {
    const c = draw({
      sources: [{ name: 'a', label: 'Collie 1', rowColor: dog }],
      rowHeight: 0.32,
      labelOffset: 0,
    })
    expect(c.querySelectorAll('text')).toHaveLength(0)
    const rect = c.querySelector('rect')
    expect(rect?.getAttribute('fill')).toBe(dog)
    expect(rect?.dataset.testid).toBeUndefined()
    // the whole run, narrow enough to be a stripe rather than the text box
    expect(rect?.getAttribute('width')).toBe(
      String(rowLabelsBoxWidth([{ name: 'a', rowColor: dog }], 0.32)),
    )
    expect(Number(rect?.getAttribute('width'))).toBeLessThan(10)
    // floored at a pixel so the mark survives; y stays exact
    expect(Number(rect?.getAttribute('height'))).toBe(1)
    expect(rect?.getAttribute('y')).toBe('0')
  })

  it('keeps a sub-pixel mark on its own row rather than shifting it', () => {
    const c = draw({
      sources: [{ name: 'a' }, { name: 'b' }, { name: 'c', rowColor: wolf }],
      rowHeight: 0.32,
      labelOffset: 0,
    })
    const rect = c.querySelector('rect')
    // third row: y = 2 * 0.32, exact, even though the rect is floored to 1px
    expect(Number(rect?.getAttribute('y'))).toBeCloseTo(0.64)
    expect(Number(rect?.getAttribute('height'))).toBe(1)
  })

  it('draws nothing below the threshold when no row carries a color', () => {
    const c = draw({
      sources: [{ name: 'a' }, { name: 'b' }],
      rowHeight: 0.32,
      labelOffset: 0,
    })
    expect(c.querySelectorAll('rect')).toHaveLength(0)
  })

  it('merges consecutive same-color rows into one rect spanning them', () => {
    const c = draw({
      sources: [
        { name: 'a', rowColor: dog },
        { name: 'b', rowColor: dog },
        { name: 'c', rowColor: dog },
        { name: 'd', rowColor: wolf },
      ],
      rowHeight: 2,
      labelOffset: 0,
    })
    const rects = [...c.querySelectorAll('rect')]
    expect(rects).toHaveLength(2)
    expect(rects[0]!.getAttribute('y')).toBe('0')
    expect(Number(rects[0]!.getAttribute('height'))).toBe(6)
    expect(rects[1]!.getAttribute('y')).toBe('6')
    expect(Number(rects[1]!.getAttribute('height'))).toBe(2)
  })

  it('does not bridge a run across an uncolored row', () => {
    const c = draw({
      sources: [
        { name: 'a', rowColor: dog },
        { name: 'b' },
        { name: 'c', rowColor: dog },
      ],
      rowHeight: 2,
      labelOffset: 0,
    })
    const rects = [...c.querySelectorAll('rect')]
    expect(rects).toHaveLength(2)
    expect(rects[0]!.getAttribute('y')).toBe('0')
    expect(rects[1]!.getAttribute('y')).toBe('4')
  })

  it('paints a rare mark last so a common run cannot bury it', () => {
    // one wolf row sandwiched in a long village-dog block: floored to a pixel,
    // whichever paints later wins the overlap, and it must be the single row
    const sources = [
      ...Array.from({ length: 20 }, (_, i) => ({
        name: `village${i}`,
        rowColor: dog,
      })),
      { name: 'wolf', rowColor: wolf },
      ...Array.from({ length: 20 }, (_, i) => ({
        name: `village${i + 20}`,
        rowColor: dog,
      })),
    ]
    const rects = [
      ...draw({ sources, rowHeight: 0.32, labelOffset: 0 }).querySelectorAll(
        'rect',
      ),
    ]
    expect(rects.at(-1)?.getAttribute('fill')).toBe(wolf)
  })

  it('culls swatch runs outside the available height', () => {
    const c = draw({
      sources: [
        { name: 'onscreen', rowColor: dog },
        { name: 'offscreen', rowColor: wolf },
      ],
      rowHeight: 4,
      labelOffset: 0,
      scrollTop: 0,
      // the second run starts at y=4, past this, so it is culled; a run starting
      // exactly on the bottom edge is kept, same as the text path
      availableHeight: 2,
    })
    expect(c.querySelectorAll('rect')).toHaveLength(1)
  })

  it('cuts a label past the cap with an ellipsis, whole in its title, and stops the strip at the cap', () => {
    const long = 'protein_coding_primary_transcript_variant_1'
    const sources = [{ name: 'a' }, { name: long }]
    const c = draw({ sources, rowHeight: 20, labelOffset: 0, backdrop: 'wash' })
    const texts = [...c.querySelectorAll('text')]
    expect(texts[0]?.textContent).toBe('a')
    expect(texts[0]?.querySelector('title')).toBeNull()
    expect(texts[1]?.querySelector('title')?.textContent).toBe(long)
    expect(texts[1]?.lastChild?.textContent).toMatch(/^protein_coding.*…$/)
    expect(rowLabelsBoxWidth(sources, 20)).toBe(ROW_LABEL_MAX_TEXT_WIDTH + 10)
    expect(c.querySelector('path')?.getAttribute('d')).toContain(
      `h${ROW_LABEL_MAX_TEXT_WIDTH + 10}`,
    )
  })
})

// `rows.annotations`: a column per annotation after the row color, each a
// row's color by name, 4 px wide at any row height.
describe('annotation columns', () => {
  const eur = '#4e79a7'
  const afr = '#f28e2c'
  const female = '#d95f02'
  const names = ['a', 'b', 'c', 'd', 'e']
  const plain = names.map(name => ({ name }))
  const colored = names.map(name => ({ name, rowColor: dog }))
  const population = new Map([
    ['a', eur],
    ['b', eur],
    ['d', eur],
    ['e', afr],
  ])
  const sex = new Map([
    ['a', female],
    ['b', female],
    ['c', female],
  ])
  const barsOf = (c: HTMLElement) =>
    [...c.querySelectorAll('[data-testid="row-annotation-bar"]')].map(bar => ({
      fill: bar.getAttribute('fill'),
      x: Number(bar.getAttribute('x')),
      y: Number(bar.getAttribute('y')),
      width: Number(bar.getAttribute('width')),
      height: Number(bar.getAttribute('height')),
    }))

  it('draws a column as one rect per run, a row with no value breaking the run', () => {
    const c = draw({
      sources: plain,
      rowHeight: 20,
      labelOffset: 0,
      annotations: [population],
    })
    expect(barsOf(c)).toEqual([
      { fill: eur, x: 0, y: 0, width: 8, height: 40 },
      { fill: eur, x: 0, y: 60, width: 8, height: 20 },
      { fill: afr, x: 0, y: 80, width: 8, height: 20 },
    ])
  })

  it('starts the columns past the row color, as wide as they are, and the text past the columns', () => {
    const textX = (c: HTMLElement) =>
      [...c.querySelectorAll('text')].map(t => t.getAttribute('x'))
    const one = draw({
      sources: plain,
      rowHeight: 20,
      labelOffset: 0,
      annotations: [population],
    })
    expect(new Set(textX(one))).toEqual(new Set(['12']))
    const two = draw({
      sources: colored,
      rowHeight: 20,
      labelOffset: 0,
      annotations: [population, sex],
    })
    expect(new Set(textX(two))).toEqual(new Set(['28']))
    expect(
      new Set(
        [...two.querySelectorAll('[data-testid="row-color-bar"]')].map(bar =>
          bar.getAttribute('width'),
        ),
      ),
    ).toEqual(new Set(['8']))
    expect(two.querySelectorAll('[data-testid="row-color-bar"]')).toHaveLength(
      5,
    )
    expect(barsOf(two).map(bar => [bar.fill, bar.x])).toEqual([
      [eur, 8],
      [eur, 8],
      [afr, 8],
      [female, 16],
    ])
  })

  it('widens the label box by 8px a column', () => {
    const bare = rowLabelsBoxWidth(plain, 20)
    expect(rowLabelsBoxWidth(plain, 20, undefined, [population])).toBe(bare + 8)
    expect(rowLabelsBoxWidth(plain, 20, undefined, [population, sex])).toBe(
      bare + 16,
    )
  })

  it('culls a run outside the available height', () => {
    const c = draw({
      sources: plain,
      rowHeight: 20,
      labelOffset: 0,
      annotations: [population],
      availableHeight: 50,
    })
    expect(barsOf(c).map(bar => bar.y)).toEqual([0])
  })

  it('draws 8px columns after the 8px swatch below the text threshold', () => {
    const c = draw({
      sources: colored,
      rowHeight: 2,
      labelOffset: 0,
      annotations: [population, sex],
    })
    expect(c.querySelectorAll('text')).toHaveLength(0)
    const rects = [...c.querySelectorAll('rect')].map(rect => ({
      fill: rect.getAttribute('fill'),
      x: Number(rect.getAttribute('x')),
      width: Number(rect.getAttribute('width')),
      height: Number(rect.getAttribute('height')),
    }))
    expect(rects).toEqual([
      { fill: dog, x: 0, width: 8, height: 10 },
      { fill: female, x: 16, width: 8, height: 6 },
      { fill: eur, x: 8, width: 8, height: 4 },
      { fill: eur, x: 8, width: 8, height: 2 },
      { fill: afr, x: 8, width: 8, height: 2 },
    ])
    expect(rowLabelsBoxWidth(colored, 2, undefined, [population, sex])).toBe(24)
  })

  it('draws the columns alone below the text threshold where no row has a color', () => {
    const c = draw({
      sources: plain,
      rowHeight: 0.32,
      labelOffset: 0,
      annotations: [population, sex, population],
    })
    const bars = barsOf(c)
    expect(bars).toHaveLength(c.querySelectorAll('rect').length)
    expect(new Set(bars.map(bar => bar.x))).toEqual(new Set([0, 8, 16]))
    expect(Math.min(...bars.map(bar => bar.height))).toBe(1)
    expect(
      rowLabelsBoxWidth(plain, 0.32, undefined, [population, sex, population]),
    ).toBe(24)
    expect(rowLabelsBoxWidth(plain, 0.32, undefined, [population])).toBe(8)
  })

  it.each([20, 2])(
    'draws the same columns on screen and in the export at a %ipx row',
    rowHeight => {
      const screen = render(
        <RowLabelsOverlay
          sources={colored}
          rowHeight={rowHeight}
          labelOffset={0}
          width={400}
          height={200}
          testId="labels"
          annotations={[population, sex]}
        />,
      ).getByTestId('labels')
      const exported = render(
        <svg>
          <SvgTreeSidebar
            sidebar={{
              showTree: false,
              hierarchy: undefined,
              sources: colored,
              rowHeight,
              treeAreaWidth: 0,
              annotations: [population, sex],
            }}
          />
        </svg>,
      ).container
      expect(barsOf(screen)).toHaveLength(4)
      expect(barsOf(exported)).toEqual(barsOf(screen))
    },
  )

  it('reserves the export gutter the columns take', () => {
    const sidebar = {
      showTree: false,
      hierarchy: undefined,
      sources: plain,
      rowHeight: 20,
      treeAreaWidth: 0,
    }
    expect(
      svgSidebarWidth({ ...sidebar, annotations: [population, sex] }),
    ).toBe(svgSidebarWidth(sidebar) + 16)
  })
})

// The screen and the export draw the same labels: `RowLabelsOverlay` on
// screen, `SvgTreeSidebar` in the export, both through `SvgRowLabels`.
describe('the label bar on screen and in the export', () => {
  const sources = [
    { name: 'a', rowColor: dog },
    { name: 'b' },
    { name: 'c', rowColor: wolf },
  ]

  function onScreen(rowHeight: number) {
    return render(
      <RowLabelsOverlay
        sources={sources}
        rowHeight={rowHeight}
        labelOffset={0}
        width={400}
        height={200}
        testId="labels"
      />,
    ).getByTestId('labels')
  }

  function inExport(rowHeight: number) {
    return render(
      <svg>
        <SvgTreeSidebar
          sidebar={{
            showTree: false,
            hierarchy: undefined,
            sources,
            rowHeight,
            treeAreaWidth: 0,
          }}
          text={{ fontSize: 12, fontFamily: 'Arial' }}
        />
      </svg>,
    ).container
  }

  it.each([
    ['on screen', onScreen],
    ['in the export', inExport],
  ])('draws a 4px bar per colored row above the text threshold %s', (_, at) => {
    const bars = [...at(20).querySelectorAll('[data-testid="row-color-bar"]')]
    expect(bars.map(b => b.getAttribute('fill'))).toEqual([dog, wolf])
    expect(bars.map(b => b.getAttribute('width'))).toEqual(['4', '4'])
  })

  it.each([
    ['on screen', onScreen],
    ['in the export', inExport],
  ])('fills each colored run below the text threshold %s', (_, at) => {
    const el = at(2)
    expect(el.querySelectorAll('[data-testid="row-color-bar"]')).toHaveLength(0)
    expect(el.querySelectorAll('text')).toHaveLength(0)
    const runs = [...el.querySelectorAll('rect')]
    expect(runs.map(r => r.getAttribute('fill')).sort()).toEqual(
      [dog, wolf].sort(),
    )
    for (const run of runs) {
      expect(run.getAttribute('width')).toBe(
        String(rowLabelsBoxWidth(sources, 2)),
      )
    }
  })
})

test('the export sidebar clips to the rows viewport, as the screen does', () => {
  const sources = ['a', 'b', 'c', 'd'].map(name => ({ name }))
  const { container } = render(
    <svg>
      <SvgTreeSidebar
        sidebar={{
          showTree: false,
          hierarchy: undefined,
          sources,
          rowHeight: 20,
          treeAreaWidth: 0,
        }}
        scrollTop={10}
        availableHeight={40}
        clipId="rows"
      />
    </svg>,
  )
  const clip = container.querySelector('clipPath rect')
  expect(clip?.getAttribute('y')).toBe('0')
  expect(clip?.getAttribute('height')).toBe('40')
  const clipped = container.querySelector('g[clip-path]')
  expect(clipped?.textContent).toContain('a')
})
