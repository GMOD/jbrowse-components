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

// ...and one that does answer, since the count is what the leading sentence is
// built out of. Only the two fields `offscreenMateCount` reads.
const countingModel = {
  ...emptyModel,
  linearSyntenyDisplays: [
    {
      featureData: {
        offscreenMates: {
          mateRefNameDict: ['ctgB'],
          counts: Uint32Array.from([12]),
        },
      },
    },
  ],
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
        rowSync="independent"
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
// tooltip; the regions the panel would give up were legible nowhere.
test('it names what the panel is showing now', () => {
  open({ replacing: ['ctgA', 'ctgC'] })
  expect(screen.getByText(/in place of ctgA and ctgC/)).toBeTruthy()
})

// A sentence a reader reads, not a comma-joined field.
test('...as a list with more than two', () => {
  open({ replacing: ['ctgA', 'ctgC', 'ctgD'] })
  expect(screen.getByText(/in place of ctgA, ctgC and ctgD/)).toBeTruthy()
})

// Past a handful the list stops being a thing to weigh and the count carries
// it — a whole-assembly row would otherwise paper the dialog with scaffolds.
test('...as a count once there are too many to read', () => {
  open({ replacing: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })
  expect(screen.getByText(/in place of the 7 regions/)).toBeTruthy()
})

// A panel displaying nothing gives nothing up, so the clause would be a
// sentence about the empty set.
test('...and says nothing about it when the panel shows nothing', () => {
  open({ replacing: [] })
  expect(screen.queryByText(/in place of/)).toBeNull()
})

// IT EXPLAINS RATHER THAN WARNS. Nothing here is dangerous and the copy should
// not imply it is — leading with what the click gives is also the clearest
// short answer to "what is this strip".
test('it leads with what the click gives, not what it costs', () => {
  open({ model: countingModel })
  expect(
    screen.getByText(/12 alignments on this band point to ctgB/),
  ).toBeTruthy()
  expect(screen.getByText(/marks rather than ribbons/)).toBeTruthy()
})

// A lane with no tally for this contig has no number to lead with, and an
// invented "0 alignments" would be a sentence contradicting the mark the reader
// just clicked.
test('...and drops the count when the lane has none', () => {
  open()
  expect(screen.getByText(/is not showing ctgB yet/)).toBeTruthy()
})

test('...and says the move is undoable', () => {
  open()
  expect(screen.getByText(/undo this afterwards/)).toBeTruthy()
})

// WHAT THE PANEL NOBODY CLICKED DOES. Naming one panel and never mentioning the
// other left a reader unable to tell whether the whole stack was about to move,
// and the answer is different in each of the three row-sync modes.
test('it says the other panel holds still', () => {
  open()
  expect(screen.getByText(/panel above stays where it is/)).toBeTruthy()
})

// Under `follow` the click TAKES the anchor, so the others are re-placed onto
// this row's mapping — which is the whole point of anchoring it.
test('...that it follows, when the rows follow each other', () => {
  open({ rowSync: 'follow' })
  expect(screen.getByText(/panel above follows it/)).toBeTruthy()
})

// Linked rows are held together in PIXELS: `installLinkedViewSync` replays a
// row's zoom onto the others and not its scroll, so the facing panel keeps its
// own regions and changes zoom with this one.
test('...and what linking actually does, which is neither', () => {
  open({ rowSync: 'link' })
  expect(
    screen.getByText(/keeps its own regions and shares the zoom/),
  ).toBeTruthy()
})

// The strips face opposite rows, so the panel that holds still is the other one
// from the panel that moves.
test('...naming the right one from the lower strip', () => {
  open({ side: 'bottom' })
  expect(screen.getByText(/panel below stays where it is/)).toBeTruthy()
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
  expect(screen.getByText(/panel above navigates to/)).toBeTruthy()
})
