import { SimpleFeature } from '@jbrowse/core/util'
import { render } from '@testing-library/react'

import BreakpointSplitViewChoiceDialog from './BreakpointSplitViewChoiceDialog.tsx'

import type { BreakpointSplitViewHost } from './util.ts'

const feature = new SimpleFeature({
  uniqueId: 'r-split',
  refName: 'chr22',
  start: 10_000,
  end: 10_500,
  mate: {
    uniqueId: 'r-split-mate',
    refName: 'chr9',
    start: 20_000,
    end: 20_300,
  },
})

function open(stops?: { refName: string; pos: number }[]) {
  return render(
    <BreakpointSplitViewChoiceDialog
      session={{} as BreakpointSplitViewHost}
      handleClose={() => {}}
      feature={feature}
      assemblyName="hg38"
      findJunctionsNear={async () => []}
      stops={stops}
    />,
  )
}

test('a record offers both shapes and the chain to follow', () => {
  const { queryByText } = open()
  expect(queryByText('Single level (single row)')).not.toBeNull()
  expect(queryByText('Follow further breakends at each end')).not.toBeNull()
  expect(
    queryByText('Opens two stacked linear genome views, one for each breakend'),
  ).not.toBeNull()
})

// A launcher holding the panels already leaves nothing to infer, and past two
// of them no single row to lay them on.
test('given stops stand the chain row down, and past two the single row', () => {
  const two = open([
    { refName: 'chr22', pos: 10_250 },
    { refName: 'chr9', pos: 20_150 },
  ])
  expect(two.queryByText('Follow further breakends at each end')).toBeNull()
  expect(two.queryByText('Single level (single row)')).not.toBeNull()
  two.unmount()

  const three = open([
    { refName: 'chr22', pos: 10_250 },
    { refName: 'chr9', pos: 20_150 },
    { refName: 'chr3', pos: 30_000 },
  ])
  expect(three.queryByText('Single level (single row)')).toBeNull()
  expect(
    three.queryByText(
      'Opens 3 stacked linear genome views, one per segment of the read',
    ),
  ).not.toBeNull()
})
