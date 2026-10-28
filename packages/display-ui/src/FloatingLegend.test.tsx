import { fireEvent, render, within } from '@testing-library/react'

import FloatingLegend from './FloatingLegend.tsx'
import { TrackOverlaySlot } from './trackOverlay/TrackOverlaySlot.tsx'

import type { LegendItem } from './FloatingLegend.tsx'

function items(n: number): LegendItem[] {
  return Array.from({ length: n }, (_, i) => ({
    color: '#000',
    label: `item${i}`,
  }))
}

function one(list: LegendItem[]) {
  return [{ id: 'items', items: list }]
}

describe('FloatingLegend', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<FloatingLegend sections={one([])} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows every item and no toggle when at or under the limit', () => {
    const { queryByText, getByText } = render(
      <FloatingLegend sections={one(items(12))} maxItems={12} />,
    )
    expect(getByText('item0')).toBeTruthy()
    expect(getByText('item11')).toBeTruthy()
    expect(queryByText(/Show .* more/)).toBeNull()
  })

  it('shows one row past the limit rather than a toggle taking its place', () => {
    const { queryByText, getByText } = render(
      <FloatingLegend sections={one(items(13))} maxItems={12} />,
    )
    expect(getByText('item12')).toBeTruthy()
    expect(queryByText(/Show .* more/)).toBeNull()
  })

  // The export draws a toggled-off category this way, and the screen has to
  // agree, or the key names a color the plot no longer shows.
  it('dims and strikes through a hidden row', () => {
    const { getByText } = render(
      <FloatingLegend
        sections={one([
          { color: 'red', label: 'gene' },
          { color: 'blue', label: 'exon', hidden: true },
        ])}
      />,
    )
    const style = (label: string) =>
      getComputedStyle(getByText(label).parentElement!)
    expect(style('exon').textDecoration).toBe('line-through')
    expect(style('exon').opacity).toBe('0.4')
    expect(style('gene').textDecoration).not.toBe('line-through')
  })

  it("draws a section's note above its rows, where a collapse cannot hide it", () => {
    const { getByText } = render(
      <FloatingLegend
        sections={[
          {
            id: 'score',
            title: 'score',
            note: 'numeric values drawn as categories',
            items: items(32),
          },
        ]}
        maxItems={12}
      />,
    )
    expect(getByText('numeric values drawn as categories')).toBeTruthy()
  })

  it('collapses past the limit and toggles on click', () => {
    const { getByText, queryByText } = render(
      <FloatingLegend sections={one(items(32))} maxItems={12} />,
    )
    // first 12 shown, the rest hidden behind a "Show N more" toggle
    expect(getByText('item11')).toBeTruthy()
    expect(queryByText('item12')).toBeNull()

    fireEvent.click(getByText('Show 20 more…'))
    expect(getByText('item31')).toBeTruthy()

    fireEvent.click(getByText('Show less'))
    expect(queryByText('item12')).toBeNull()
  })

  it('counts only the rows that key a color behind the toggle', () => {
    const { getByText } = render(
      <FloatingLegend
        sections={one([...items(20), { label: 'a note' }])}
        maxItems={12}
      />,
    )
    expect(getByText('Show 8 more…')).toBeTruthy()
  })

  // A row two vocabularies produced shows both colors, so the box count is the
  // count of colors drawn rather than of rows.
  it('draws one box per color, both of them when a row has two', () => {
    const { container } = render(
      <FloatingLegend
        sections={one([
          { color: '#aaa', label: 'LR - Normal pair orientation' },
          { color: '#f00', label: 'Long insert' },
          {
            label: 'Short insert',
            swatches: [{ color: '#ffc0cb' }, { color: '#ff3a8c' }],
          },
        ])}
      />,
    )
    expect(container.querySelectorAll('rect')).toHaveLength(4)
    expect(container.querySelectorAll('svg')).toHaveLength(4)
  })

  it('shows section titles and per-section close when multi-section', () => {
    const onDismissSection = jest.fn()
    const { getByText, getByLabelText } = render(
      <FloatingLegend
        sections={[
          { id: 'genotypes', title: 'Genotypes', items: items(2) },
          { id: 'group', title: 'Population', items: items(2) },
        ]}
        onDismissSection={onDismissSection}
      />,
    )
    expect(getByText('Genotypes')).toBeTruthy()
    expect(getByText('Population')).toBeTruthy()
    fireEvent.click(getByLabelText('Hide Population'))
    expect(onDismissSection).toHaveBeenCalledWith('group')
  })

  it('hides section titles when only one section', () => {
    const { queryByText, getByText } = render(
      <FloatingLegend
        sections={[{ id: 'genotypes', title: 'Genotypes', items: items(2) }]}
      />,
    )
    expect(getByText('item0')).toBeTruthy()
    expect(queryByText('Genotypes')).toBeNull()
  })

  it('shows a top-level title over a single section', () => {
    const { getByText } = render(
      <FloatingLegend title="r² to index" sections={one(items(2))} />,
    )
    expect(getByText('r² to index')).toBeTruthy()
    expect(getByText('item0')).toBeTruthy()
  })

  // Canvas, alignments, variants and multi-wiggle displays render this
  // component directly, so it sits behind NEITHER bring-your-own seam: an
  // embedder who mounts `DisplayUIProvider` and expects no Material UI still
  // gets whatever this file renders. It used to be two `IconButton`s and a
  // `Link`.
  //
  // Pinned here for the same reason `BaseTooltip.test.tsx` is: the census that
  // would otherwise catch it (`products/jbrowse-build-your-own`'s `pnpm smoke`)
  // can only count a legend that some page actually raises, and no page there
  // turns on a colorBy that raises one. A browser check that never runs is not
  // a check.
  // Only a section whose entries name rows acts, and only with a handler: a
  // display keying features beside its row groups offers no dead buttons.
  it('makes the rows act only in a section that names rows, given a handler', () => {
    const clicked: string[] = []
    const groups = { id: 'group', title: 'Population', items: items(2) }
    const { getByText, rerender } = render(
      <FloatingLegend
        sections={[
          {
            id: 'genotypes',
            title: 'Genotypes',
            items: [{ label: 'ref', color: 'red', value: 'ref' }],
          },
          { ...groups, focusesRows: true },
        ]}
        onItemClick={(item, section) => {
          clicked.push(`${section.id}:${item.label}`)
        }}
      />,
    )
    fireEvent.click(getByText('item1'))
    expect(clicked).toEqual(['group:item1'])
    expect(getByText('ref').closest('button')).toBeNull()

    rerender(<FloatingLegend sections={[groups]} onItemClick={jest.fn()} />)
    expect(getByText('item1').closest('button')).toBeNull()
  })

  it('leaves a note row inert in a section that names rows', () => {
    const { getByText } = render(
      <FloatingLegend
        sections={[
          {
            id: 'rowColor',
            focusesRows: true,
            items: [
              { label: 'Wolf', color: 'red', value: 'Wolf' },
              { label: '+3 more', value: '' },
            ],
          },
        ]}
        onItemClick={jest.fn()}
      />,
    )
    expect(getByText('Wolf').closest('button')).not.toBeNull()
    expect(getByText('+3 more').closest('button')).toBeNull()
  })

  describe('in a display shorter than the key', () => {
    const ROW = 13
    const VISIBLE = 100
    let rect: jest.SpyInstance

    // jsdom lays nothing out, so the mock shows VISIBLE px of the scroller and
    // stacks each counted element ROW px below the last, less `scrollTop`.
    beforeEach(() => {
      rect = jest
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement) {
          const scroller = this.closest('[data-testid="floating-legend"]')
            ?.firstElementChild as HTMLElement | null
          if (this.dataset.legendCount !== undefined && scroller) {
            const counted = [
              ...scroller.querySelectorAll('[data-legend-count]'),
            ]
            const bottom =
              (counted.indexOf(this) + 1) * ROW - scroller.scrollTop
            return { bottom } as DOMRect
          }
          return { bottom: VISIBLE } as DOMRect
        })
    })
    afterEach(() => {
      rect.mockRestore()
    })

    it('counts the entries below the fold, collapsed ones included', () => {
      const { getByText } = render(
        <FloatingLegend sections={one(items(32))} maxItems={12} />,
      )
      // rows 8-12 lie below 100px, and the toggle hides 20 more
      expect(getByText('25 more ▾')).toBeTruthy()
    })

    it('recounts on scroll and drops the cue at the bottom', () => {
      const { getByTestId, getByText, queryByText } = render(
        <FloatingLegend sections={one(items(10))} />,
      )
      expect(getByText('3 more ▾')).toBeTruthy()
      const scroller = getByTestId('floating-legend').firstElementChild!
      scroller.scrollTop = 3 * ROW
      fireEvent.scroll(scroller)
      expect(queryByText(/more ▾/)).toBeNull()
    })

    it('shows no cue when every entry fits', () => {
      const { queryByText } = render(
        <FloatingLegend sections={one(items(7))} />,
      )
      expect(queryByText(/more ▾/)).toBeNull()
    })
  })

  it('keeps a wheel over a scrollable key from reaching the view', () => {
    const viewWheel = jest.fn()
    const { getByTestId } = render(
      <div ref={el => el?.addEventListener('wheel', viewWheel)}>
        <FloatingLegend sections={one(items(30))} maxItems={30} />
      </div>,
    )
    const scroller = getByTestId('floating-legend').firstElementChild!
    Object.defineProperties(scroller, {
      scrollHeight: { value: 400 },
      clientHeight: { value: 100 },
    })
    fireEvent.wheel(scroller, { deltaY: 40 })
    expect(viewWheel).not.toHaveBeenCalled()
    fireEvent.wheel(getByTestId('floating-legend'), { deltaY: 40 })
    expect(viewWheel).not.toHaveBeenCalled()
    fireEvent.wheel(scroller, { deltaY: 40, ctrlKey: true })
    expect(viewWheel).toHaveBeenCalledTimes(1)
  })

  it('renders no Material UI, in every state that has a control', () => {
    const { container } = render(
      <FloatingLegend
        // all three controls at once: the box close, a section close, and the
        // overflow toggle
        sections={[
          { id: 'genotypes', title: 'Genotypes', items: items(32) },
          { id: 'group', title: 'Population', items: items(2) },
        ]}
        maxItems={12}
        onDismiss={jest.fn()}
        onDismissSection={jest.fn()}
      />,
    )
    expect(container.querySelectorAll('[class*="Mui"]')).toHaveLength(0)
  })
})

describe('a summarized section', () => {
  const summarized = [
    { id: 'pfam', items: items(34), summary: 'Pfam family · 34 values' },
  ]

  it('draws one line until clicked, then every row', () => {
    const { getByText, queryByText } = render(
      <FloatingLegend sections={summarized} maxItems={12} />,
    )
    expect(queryByText('item0')).toBeNull()
    fireEvent.click(getByText('Pfam family · 34 values'))
    expect(getByText('item33')).toBeTruthy()
    expect(queryByText(/Show .* more/)).toBeNull()
    fireEvent.click(getByText('Pfam family · 34 values'))
    expect(queryByText('item0')).toBeNull()
  })

  it('stands in for the section title beside other sections', () => {
    const { getByText, queryByText } = render(
      <FloatingLegend
        sections={[
          { ...summarized[0]!, title: 'Pfam family' },
          { id: 'b', title: 'Strand', items: items(2) },
        ]}
      />,
    )
    expect(getByText('Pfam family · 34 values')).toBeTruthy()
    expect(queryByText('Pfam family')).toBeNull()
  })
})

describe('the close button', () => {
  const rowPadding = (label: string, el: HTMLElement) =>
    getComputedStyle(within(el).getByText(label).parentElement!).paddingRight

  it('is cleared by the title line alone', () => {
    const { getByText, baseElement } = render(
      <FloatingLegend
        title="Type"
        sections={one(items(2))}
        onDismiss={jest.fn()}
      />,
    )
    expect(getComputedStyle(getByText('Type')).paddingRight).toBe('13px')
    expect(rowPadding('item0', baseElement)).not.toBe('13px')
  })

  it('is cleared by the first row where there is no title', () => {
    const { baseElement } = render(
      <FloatingLegend sections={one(items(2))} onDismiss={jest.fn()} />,
    )
    expect(rowPadding('item0', baseElement)).toBe('13px')
    expect(rowPadding('item1', baseElement)).not.toBe('13px')
  })
})

test('the key climbs beside an in-flow track label', () => {
  const { getByTestId } = render(
    <TrackOverlaySlot zIndex={1} labelBand={30}>
      <FloatingLegend sections={one(items(2))} />
    </TrackOverlaySlot>,
  )
  const { style } = getByTestId('floating-legend')
  expect([style.top, style.maxHeight]).toEqual(['-20px', 'calc(100% - -16px)'])
})
