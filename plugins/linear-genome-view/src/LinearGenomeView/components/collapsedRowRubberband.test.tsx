import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render, waitFor } from '@testing-library/react'

import LinearGenomeViewContainer from './LinearGenomeViewContainer.tsx'

import type { LinearGenomeViewModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const assemblyConf = {
  name: 'volMyt1',
  sequence: {
    trackId: 'sequenceConfigId',
    type: 'ReferenceSequenceTrack',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'firstId',
          start: 0,
          end: 10_000,
          seq: 'cattgttgcg'.repeat(1000),
        },
      ],
    },
  },
}

async function renderView(scalebarOnly: boolean) {
  const session = createTestSession()
  session.addAssemblyConf(assemblyConf)
  session.addView('LinearGenomeView', {
    id: `lgv-${scalebarOnly}`,
    scalebarOnly,
    displayedRegions: [
      { refName: 'ctgA', start: 0, end: 10_000, assemblyName: 'volMyt1' },
    ],
  })
  const model = session.views[0] as LinearGenomeViewModel
  model.setWidth(800)
  await waitFor(() => {
    expect(model.initialized).toBe(true)
  })

  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LinearGenomeViewContainer model={model} />
    </ThemeProvider>,
  )
  return { model, container }
}

// What the collapse is allowed to take away, and what it is not.
//
// `scalebarOnly` is how a multi-way synteny launch opens its mate rows: a row
// with no tracks would otherwise be a "No tracks active" block taller than the
// ruler it exists to show. That is a HEIGHT decision, and it used to take the
// ruler's gesture with it — the branch rendered a bare `Scalebar`, so a
// collapsed row had no `rubberband_controls` and could not be drag-selected,
// which is the one way a stack is re-anchored on one of its own genomes.
//
// The testid is the pin rather than a synthetic drag: which element carries the
// range-select handlers is a DOM fact jsdom sees exactly, and `useRangeSelect`
// has its own test.
test('a collapsed row keeps the scalebar rubberband', async () => {
  const { container } = await renderView(true)

  expect(container.querySelector('[data-testid="tracksContainer"]')).toBeNull()
  expect(
    container.querySelector('[data-testid="rubberband_controls"]'),
  ).not.toBeNull()
})

test('an uncollapsed view has both', async () => {
  const { container } = await renderView(false)

  expect(
    container.querySelector('[data-testid="tracksContainer"]'),
  ).not.toBeNull()
  expect(
    container.querySelector('[data-testid="rubberband_controls"]'),
  ).not.toBeNull()
})

// The handle a nested row is reached BY. App-core's ViewContainer stamps
// `view-container-<id>` around each of the session's own views and nothing
// wraps a synteny row, so without this every `rubberband_controls` on a stack
// looks the same and a figure or a tour has to pick the nth one.
test('the view carries its own id in the DOM', async () => {
  const { model, container } = await renderView(true)

  // Matched by prefix and read back off the element rather than interpolated
  // into the selector: `unicorn/require-css-escape` wants `CSS.escape` around
  // an interpolated value, and jsdom has no global `CSS` to call it on.
  const box = container.querySelector<HTMLElement>(
    '[data-testid^="linear-genome-view-"]',
  )

  expect(box?.dataset.testid).toBe(`linear-genome-view-${model.id}`)
})
