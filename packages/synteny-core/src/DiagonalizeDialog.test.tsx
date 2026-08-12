import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import DiagonalizeDialog from './DiagonalizeDialog.tsx'

import type {
  DiagonalizeRunOpts,
  DiagonalizeStats,
} from './diagonalizeTypes.ts'

function renderDialog(
  run: (opts: DiagonalizeRunOpts) => Promise<DiagonalizeStats | undefined>,
  handleClose = () => {},
) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DiagonalizeDialog
        handleClose={handleClose}
        description="Reorders the vertical axis to match the horizontal."
        run={run}
      />
    </ThemeProvider>,
  )
}

const stats = { totalReordered: 3, totalReversed: 1 }

// The reorder is a long RPC over remote alignment files, so it fails for
// reasons that have nothing to do with the request. The only way back to Start
// was to close the dialog and pick the menu item again.
test('a failed run can be retried in place', async () => {
  let attempts = 0
  renderDialog(() => {
    attempts++
    return attempts === 1
      ? Promise.reject(new Error('tabix query failed'))
      : Promise.resolve(stats)
  })

  fireEvent.click(screen.getByText('Start'))
  expect(await screen.findByText(/tabix query failed/)).toBeTruthy()

  fireEvent.click(screen.getByText('Retry'))
  expect(
    await screen.findByText('Done: reordered 3 regions, reversed 1'),
  ).toBeTruthy()
  expect(attempts).toBe(2)
})

// the reorder it just reported is the state of the view, so a second identical
// pass has nothing to find
test('a finished run offers only Close', async () => {
  renderDialog(() => Promise.resolve(stats))

  fireEvent.click(screen.getByText('Start'))
  expect(
    await screen.findByText('Done: reordered 3 regions, reversed 1'),
  ).toBeTruthy()
  expect(screen.queryByText('Start')).toBeNull()
  expect(screen.queryByText('Retry')).toBeNull()
  expect(screen.getByText('Close')).toBeTruthy()
})

// closing mid-run would leave the RPC going with nothing showing its progress,
// so Stop is the only way out and it cancels rather than detaching
test('a run in flight offers Stop instead of Close', () => {
  renderDialog(() => new Promise<DiagonalizeStats>(() => {}))

  fireEvent.click(screen.getByText('Start'))
  expect(screen.getByText('Stop')).toBeTruthy()
  expect(screen.queryByText('Close')).toBeNull()
})
