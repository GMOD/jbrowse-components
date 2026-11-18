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
    model.setColorField('strand')
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

// One-shot actions only: what draws the plot, and the aspect lock, are settings
test('the ⋮ menu holds actions, not settings', async () => {
  await setup()
  openViewMenu()
  expect(screen.getByText('Zoom out fully')).toBeInTheDocument()
  expect(
    screen.queryByText('Lock aspect ratio (same bp/px)'),
  ).not.toBeInTheDocument()
  expect(screen.queryByText('Show')).not.toBeInTheDocument()
  expect(screen.queryByText('CIGAR indels')).not.toBeInTheDocument()
  expect(screen.queryByText(/^Gridlines/)).not.toBeInTheDocument()
})

test('the square and rectangular rows leave the menu while the aspect lock is on', async () => {
  const { model } = await setup()
  openViewMenu()
  expect(
    screen.getByText('Square view - same bp per pixel'),
  ).toBeInTheDocument()
  expect(
    screen.getByText('Rectangular view - same total bp'),
  ).toBeInTheDocument()
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })

  act(() => {
    model.setRatio(1)
  })
  openViewMenu()
  expect(
    screen.queryByText('Square view - same bp per pixel'),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByText('Rectangular view - same total bp'),
  ).not.toBeInTheDocument()
  expect(screen.getByText('Zoom out fully')).toBeInTheDocument()
})
