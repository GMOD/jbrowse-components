import { render } from '@testing-library/react'

import { selectionRegion } from '../openSubsequenceWidget.ts'
import MafAlignmentTooltipContents from './MafAlignmentTooltipContents.tsx'

import type { PxToBpResult } from '@jbrowse/core/util/Base1DUtils'

function rows(node: React.ReactElement) {
  const { container } = render(node)
  return Object.fromEntries(
    [...container.querySelectorAll('tr')].map(tr => {
      const [label, value] = tr.querySelectorAll('td')
      return [label?.textContent ?? '', value?.textContent ?? '']
    }),
  )
}

const p2 = { refName: 'chr1', coord: 1000 }

function px(over: Partial<PxToBpResult>) {
  return {
    refName: 'chr1',
    assemblyName: 'volvox',
    start: 0,
    end: 2000,
    index: 0,
    reversed: false,
    oob: false,
    ...over,
  } as PxToBpResult
}

// The readout during a drag names the span `openSubsequenceWidget` extracts
// from it: both read `selectionRegion`.
describe('the drag-selection readout', () => {
  it('counts both ends, so a one-base drag is 1 bp', () => {
    expect(
      rows(
        <MafAlignmentTooltipContents
          selection={{ refName: 'chr1', start: 999, end: 1000 }}
          p2={p2}
        />,
      ),
    ).toEqual({
      Start: 'chr1:1,000',
      End: 'chr1:1,000',
      Length: '1bp',
    })
  })

  it('a drag into the next region reads to the first region’s edge', () => {
    const selection = selectionRegion(
      px({ offset: 1899.5 }),
      px({ refName: 'chr2', index: 1, start: 0, end: 500, offset: 20.5 }),
    )
    expect(
      rows(<MafAlignmentTooltipContents selection={selection} p2={p2} />),
    ).toEqual({
      Start: 'chr1:1,900',
      End: 'chr1:2,000',
      Length: '101bp',
    })
  })
})
