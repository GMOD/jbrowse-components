import { render } from '@testing-library/react'

import { RowLabelsOverlay } from './RowLabelsOverlay.tsx'

const sources = [{ name: 'a' }, { name: 'b' }]

const props = {
  sources,
  rowHeight: 20,
  labelOffset: 0,
  width: 400,
  height: 40,
  testId: 'labels',
}

describe('RowLabelsOverlay', () => {
  it('draws the row names by default', () => {
    const { getByTestId } = render(<RowLabelsOverlay {...props} />)
    expect(getByTestId('labels').textContent).toBe('ab')
  })

  // The point of the flag: the labels are an overlay ON the plot, so on a wide
  // view they cover the left of the rows they name.
  it('drops the names when showLabels is false', () => {
    const { getByTestId } = render(
      <RowLabelsOverlay {...props} showLabels={false} />,
    )
    expect(getByTestId('labels').textContent).toBe('')
  })

  // Displays gate screenshot capture and tests on this element existing, since
  // it only appears once rows are derived from fetched data. Guarding the
  // element on showLabels rather than its contents would make hiding the labels
  // also disarm that gate, and figures would capture blank.
  it('keeps the overlay element itself when showLabels is false', () => {
    const { queryByTestId } = render(
      <RowLabelsOverlay {...props} showLabels={false} />,
    )
    expect(queryByTestId('labels')).not.toBeNull()
  })

  it('renders nothing at all when there are no rows', () => {
    const { queryByTestId } = render(
      <RowLabelsOverlay {...props} sources={[]} />,
    )
    expect(queryByTestId('labels')).toBeNull()
  })
})
