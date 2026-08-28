import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import ShowOffscreenMateDialog from './ShowOffscreenMateDialog.tsx'

import type { OffscreenMateSource } from './offscreenMateStrip.ts'

// The count comes off the lane tallies, which is the one thing here that is not
// a prop — a level with no displays answers zero, which is the shape a test of
// the COPY wants.
const emptyModel = {
  level: 0,
  linearSyntenyDisplays: [],
  parentView: {
    showOffscreenMates: true,
    bidirectionalFetch: false,
    minAlignmentLength: 0,
    overdrawPx: 1000,
    width: 800,
    views: [],
  },
} as unknown as OffscreenMateSource

function open(over: Record<string, unknown> = {}) {
  const onConfirm = jest.fn()
  const handleClose = jest.fn()
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ShowOffscreenMateDialog
        model={emptyModel}
        refName="ctgB"
        side="top"
        loc="ctgB:190,000-210,000"
        replacing={['ctgA']}
        onConfirm={onConfirm}
        handleClose={handleClose}
        {...over}
      />
    </ThemeProvider>,
  )
  return { onConfirm, handleClose }
}

test('it names the contig it is about to show', () => {
  open()
  expect(screen.getByText('Show ctgB?')).toBeTruthy()
})

test('it names the destination the row will land at', () => {
  open()
  expect(screen.getByText(/ctgB:190,000-210,000/)).toBeTruthy()
})

// THE POINT OF THE DIALOG. The destination was already legible from the
// tooltip; what the reader could not see was the region list they were about to
// lose.
test('it names what the panel is showing now', () => {
  open({ replacing: ['ctgA', 'ctgC'] })
  expect(screen.getByText(/ctgA, ctgC/)).toBeTruthy()
})

// Past a handful the list stops being a thing to weigh and the count carries
// it — a whole-assembly row would otherwise paper the dialog with scaffolds.
test('...as a count once there are too many to read', () => {
  open({ replacing: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })
  expect(screen.getByText(/7 regions/)).toBeTruthy()
})

// A row displaying nothing loses nothing, so the warning would be a sentence
// about the empty set.
test('...and says nothing about it when there is nothing to lose', () => {
  open({ replacing: [] })
  expect(screen.queryByText(/replaces what the panel/)).toBeNull()
})

test('confirming runs the navigation and closes', () => {
  const { onConfirm, handleClose } = open()
  fireEvent.click(screen.getByText('Show'))
  expect(onConfirm).toHaveBeenCalled()
  expect(handleClose).toHaveBeenCalled()
})

test('cancelling closes without navigating', () => {
  const { onConfirm, handleClose } = open()
  fireEvent.click(screen.getByText('Cancel'))
  expect(onConfirm).not.toHaveBeenCalled()
  expect(handleClose).toHaveBeenCalled()
})

// The two strips face opposite rows, and a dialog naming the wrong one
// describes a navigation that then rewrites the other.
test('it names the panel the click will move', () => {
  open({ side: 'bottom' })
  expect(screen.getByText(/panel above/)).toBeTruthy()
})
