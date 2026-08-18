import { fireEvent, render } from '@testing-library/react'

import FloatingLegend from './FloatingLegend.tsx'

import type { LegendItem } from './FloatingLegend.tsx'

function items(n: number): LegendItem[] {
  return Array.from({ length: n }, (_, i) => ({
    color: '#000',
    label: `item${i}`,
  }))
}

describe('FloatingLegend', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<FloatingLegend items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows every item and no toggle when at or under the limit', () => {
    const { queryByText, getByText } = render(
      <FloatingLegend items={items(12)} maxItems={12} />,
    )
    expect(getByText('item0')).toBeTruthy()
    expect(getByText('item11')).toBeTruthy()
    expect(queryByText(/Show .* more/)).toBeNull()
  })

  it('collapses past the limit and toggles on click', () => {
    const { getByText, queryByText } = render(
      <FloatingLegend items={items(32)} maxItems={12} />,
    )
    // first 12 shown, the rest hidden behind a "Show N more" toggle
    expect(getByText('item11')).toBeTruthy()
    expect(queryByText('item12')).toBeNull()

    fireEvent.click(getByText('Show 20 more…'))
    expect(getByText('item31')).toBeTruthy()

    fireEvent.click(getByText('Show less'))
    expect(queryByText('item12')).toBeNull()
  })

  // A display drawing bodies and connectors at once keys colors from both, and
  // a square for each says a color exists without saying what shape to find.
  it('draws a row as the mark it names, and both marks when it has two', () => {
    const { container } = render(
      <FloatingLegend
        items={[
          { color: '#aaa', label: 'LR - Normal pair orientation' },
          { color: '#f00', label: 'Long insert', mark: 'curve' },
          {
            label: 'Short insert',
            swatches: [
              { color: '#ffc0cb' },
              { color: '#ff3a8c', mark: 'curve' },
            ],
          },
        ]}
      />,
    )
    // two fills (the grey, and the pale half of short insert) and two arcs
    expect(container.querySelectorAll('rect')).toHaveLength(2)
    expect(container.querySelectorAll('path')).toHaveLength(2)
    // …the two arcs being one row's own mark and one row's second mark
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

  it('shows a top-level title with a single item list', () => {
    const { getByText } = render(
      <FloatingLegend title="r² to index" items={items(2)} />,
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
