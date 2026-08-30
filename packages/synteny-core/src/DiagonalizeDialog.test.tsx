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

let closed = false
beforeEach(() => {
  closed = false
})

// The reorder is a long RPC over remote alignment files, so it fails for
// reasons that have nothing to do with the request. The only way back to Start
// was to close the dialog and pick the menu item again.
test('a failed run can be retried in place', async () => {
  const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
  let attempts = 0
  renderDialog(() => {
    attempts++
    return attempts === 1
      ? Promise.reject(new Error('tabix query failed'))
      : Promise.resolve(stats)
  })

  fireEvent.click(screen.getByText('Start'))
  expect(await screen.findByText(/tabix query failed/)).toBeTruthy()
  expect(`${reported.mock.calls[0]?.[0]}`).toContain('tabix query failed')
  reported.mockRestore()

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

// A stacked run commits each level before starting the next, so a stop leaves
// the rows above the stop point reordered and the ones below untouched. Closing
// on that said nothing at all about it.
test('a stop reports what the cascade had already committed', async () => {
  let stop = () => {}
  renderDialog(
    ({ stopToken, onProgress }) =>
      new Promise<DiagonalizeStats>((_resolve, reject) => {
        onProgress?.({ totalReordered: 7, totalReversed: 2 })
        stop = () => {
          reject(new Error(`aborted ${String(stopToken)}`))
        }
      }),
    () => {
      closed = true
    },
  )

  fireEvent.click(screen.getByText('Start'))
  fireEvent.click(screen.getByText('Stop'))
  stop()

  expect(
    await screen.findByText(
      /Stopped after reordering 7 regions, reversed 2\. The rows below that were not reached/,
    ),
  ).toBeTruthy()
  // the point of the change: it reports rather than vanishing
  expect(closed).toBe(false)
  expect(screen.getByText('Close')).toBeTruthy()
})

// the dotplot applies once at the end, so an abort there really did change
// nothing — saying "the rows below were not reached" would be a lie
test('a stop with nothing committed says so', async () => {
  let stop = () => {}
  renderDialog(
    () =>
      new Promise<DiagonalizeStats>((_resolve, reject) => {
        stop = () => {
          reject(new Error('aborted'))
        }
      }),
  )

  fireEvent.click(screen.getByText('Start'))
  fireEvent.click(screen.getByText('Stop'))
  stop()

  expect(
    await screen.findByText('Stopped. Nothing had been reordered yet.'),
  ).toBeTruthy()
})

// closing mid-run would leave the RPC going with nothing showing its progress,
// so Stop is the only way out and it cancels rather than detaching
test('a run in flight offers Stop instead of Close', () => {
  renderDialog(() => new Promise<DiagonalizeStats>(() => {}))

  fireEvent.click(screen.getByText('Start'))
  expect(screen.getByText('Stop')).toBeTruthy()
  expect(screen.queryByText('Close')).toBeNull()
})
