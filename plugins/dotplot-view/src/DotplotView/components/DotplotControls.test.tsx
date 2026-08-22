import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSessionAsync } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, screen } from '@testing-library/react'

import DotplotControls from './DotplotControls.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// Nothing rendered this header before, so the palette button moving into
// synteny-core — and picking up the tooltip only its synteny twin used to have —
// was covered by the typechecker alone.
async function setup() {
  const session = (await createTestSessionAsync({
    sessionSnapshot: {
      views: [
        {
          type: 'DotplotView',
          height: 600,
          assemblyNames: ['volvox', 'volvox'],
          hview: {
            bpPerPx: 1,
            offsetPx: 0,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
            ],
          },
          vview: {
            bpPerPx: 1,
            offsetPx: 0,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
            ],
          },
        },
      ],
    },
  })) as any
  const model = session.views[0]
  const utils = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DotplotControls model={model} />
    </ThemeProvider>,
  )
  return { model, ...utils }
}

test('the palette button says which mode the plot is in', async () => {
  const { model } = await setup()
  // the aria-label, not the tooltip's own node, which only mounts on hover
  expect(screen.getByTestId('color_by_menu')).toHaveAttribute(
    'aria-label',
    'Color by: Default',
  )
  act(() => {
    model.setColorBy('strand')
  })
  expect(screen.getByTestId('color_by_menu')).toHaveAttribute(
    'aria-label',
    'Color by: Strand',
  )
})

// the settings menu is all about drawn points, so it stays out of the header
// until there is a track to draw. Found by title, the only handle its trigger
// has.
test('the settings menu appears only once a track is loaded', async () => {
  await setup()
  expect(
    screen.queryByLabelText('Dotplot display settings'),
  ).not.toBeInTheDocument()
})

// The ⋮ button carries no label of its own, so its icon is the handle.
function openViewMenu() {
  fireEvent.click(screen.getByTestId('MoreVertIcon').closest('button')!)
}

// Both rows draw the plot, so they are settings now. What is left of the
// submenu that held them is one row about framing, promoted rather than kept
// behind a hop of its own.
test('the ⋮ menu keeps what the view is, not what it looks like', async () => {
  await setup()
  openViewMenu()
  expect(screen.getByText('Lock aspect ratio (same bp/px)')).toBeInTheDocument()
  expect(screen.queryByText('Show...')).not.toBeInTheDocument()
  expect(
    screen.queryByText('Draw CIGAR insertions/deletions'),
  ).not.toBeInTheDocument()
  expect(screen.queryByText(/^Gridlines/)).not.toBeInTheDocument()
})

test('the aspect lock row reports the model and writes it back', async () => {
  const { model } = await setup()
  openViewMenu()
  const name = 'Lock aspect ratio (same bp/px)'
  // the row's glyph is where its state is, not an aria attribute
  expect(
    screen
      .getByRole('menuitem', { name })
      .querySelector('[data-testid="CheckBoxOutlineBlankIcon"]'),
  ).toBeInTheDocument()

  fireEvent.click(screen.getByRole('menuitem', { name }))
  expect(model.lockAspectRatio).toBe(true)
})
