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

  it('shows section titles and per-section close when multi-section', () => {
    const onDismissSection = jest.fn()
    const { getByText, getByTitle } = render(
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
    fireEvent.click(getByTitle('Hide Population'))
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
})
