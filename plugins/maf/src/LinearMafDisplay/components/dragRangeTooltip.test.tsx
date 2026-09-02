import { render } from '@testing-library/react'

import MafAlignmentTooltipContents from './MafAlignmentTooltipContents.tsx'

function rows(node: React.ReactElement) {
  const { container } = render(node)
  return Object.fromEntries(
    [...container.querySelectorAll('tr')].map(tr => {
      const [label, value] = tr.querySelectorAll('td')
      return [label?.textContent ?? '', value?.textContent ?? '']
    }),
  )
}

// The readout during a drag names the span `openSubsequenceWidget` will extract
// from it, and that widget takes `max - min + 1` bases.
describe('the drag-selection readout', () => {
  it('counts both ends, so a one-base drag is 1 bp', () => {
    expect(
      rows(
        <MafAlignmentTooltipContents
          p1={{ refName: 'chr1', coord: 1000 }}
          p2={{ refName: 'chr1', coord: 1000 }}
        />,
      ),
    ).toEqual({
      Start: 'chr1:1,000',
      End: 'chr1:1,000',
      Length: '1bp',
    })
  })

  it('agrees with the widget over a longer drag', () => {
    expect(
      rows(
        <MafAlignmentTooltipContents
          p1={{ refName: 'chr1', coord: 1100 }}
          p2={{ refName: 'chr1', coord: 1000 }}
        />,
      ).Length,
    ).toBe('101bp')
  })
})
