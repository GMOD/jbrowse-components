import { types } from '@jbrowse/mobx-state-tree'
import { render } from '@testing-library/react'

import TrackWarningsButton from './TrackWarningsButton.tsx'

import type { TrackWarning } from './trackWarnings.ts'

function host(counts: number[]) {
  const trackWarnings: TrackWarning[] = counts.map((n, i) => ({
    name: `track${i}`,
    warnings: Array.from({ length: n }, () => ({
      message: 'swapped',
      effect: 'misplaced',
    })),
  }))
  return types
    .model({})
    .volatile(() => ({ trackWarnings }))
    .create()
}

test('draws nothing while no track has a warning', () => {
  const { container } = render(
    <TrackWarningsButton model={host([])} noun="dotplot" title="t" />,
  )
  expect(container.innerHTML).toBe('')
})

// counted per warning, not per track, and named by the view's noun: the
// synteny figure spec finds the button by `synteny warning` in its label
test('counts every warning across tracks under the view noun', () => {
  const { getByLabelText } = render(
    <TrackWarningsButton model={host([2, 1])} noun="synteny" title="t" />,
  )
  expect(getByLabelText(/3 synteny warnings/)).toBeTruthy()
})
