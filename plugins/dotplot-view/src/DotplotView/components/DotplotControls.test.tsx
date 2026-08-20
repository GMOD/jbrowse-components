import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, render, screen } from '@testing-library/react'

import DotplotControls from './DotplotControls.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// Nothing rendered this header before, so the palette button moving into
// synteny-core — and picking up the tooltip only its synteny twin used to have —
// was covered by the typechecker alone.
function setup() {
  const session = createTestSession({
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
  }) as any
  const model = session.views[0]
  const utils = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DotplotControls model={model} />
    </ThemeProvider>,
  )
  return { model, ...utils }
}

test('the palette button says which mode the plot is in', () => {
  const { model } = setup()
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
test('the settings menu appears only once a track is loaded', () => {
  setup()
  expect(
    screen.queryByLabelText('Dotplot display settings'),
  ).not.toBeInTheDocument()
})
