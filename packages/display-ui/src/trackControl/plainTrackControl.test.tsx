import { fireEvent, render, screen } from '@testing-library/react'

import plainTrackControl from './plainTrackControl.tsx'

import type { TrackControlProps } from './types.ts'

// The plain control on its own. `plugins/linear-genome-view`'s `trackControl`
// suite holds this and the Material one to the same behavioural bar through the
// shared `TrackControl` resolver, which is the test that matters for the seam —
// but it needs that plugin to reach the Material half, so everything provable
// without it belongs here, in the package that can break it.
//
// The keyboard is the half a screenshot cannot see and the shared suite did not
// cover. `role="menu"` is a promise to a screen-reader user, and the Material
// control keeps it only because MUI's `Menu` does; a host swapping this in was
// trading working keyboard operation for a look.

const PlainTrackControl = plainTrackControl

function options(onSelect = () => {}) {
  return [
    { label: 'Auto', selected: false, onSelect: () => {} },
    { label: 'Fit to height', selected: true, onSelect: () => {} },
    { label: 'All transcripts', selected: false, onSelect },
  ]
}

function open(props: Partial<TrackControlProps> = {}) {
  render(
    <PlainTrackControl
      icon="height"
      tooltip="Track sizing"
      options={options()}
      {...props}
    />,
  )
  fireEvent.click(screen.getByLabelText('Track sizing'))
}

// the check mark rides in the label text, so strip it to name the option
function focusedLabel() {
  return document.activeElement?.textContent.replace('✓ ', '')
}

test('opening lands on the option already chosen', () => {
  open()
  expect(focusedLabel()).toBe('Fit to height')
})

test('the arrows walk the list and wrap at both ends', () => {
  open()

  fireEvent.keyDown(document, { key: 'ArrowDown' })
  expect(focusedLabel()).toBe('All transcripts')
  // off the bottom and round to the top
  fireEvent.keyDown(document, { key: 'ArrowDown' })
  expect(focusedLabel()).toBe('Auto')
  // and back the other way
  fireEvent.keyDown(document, { key: 'ArrowUp' })
  expect(focusedLabel()).toBe('All transcripts')
})

test('Home and End reach the ends', () => {
  open()

  fireEvent.keyDown(document, { key: 'End' })
  expect(focusedLabel()).toBe('All transcripts')
  fireEvent.keyDown(document, { key: 'Home' })
  expect(focusedLabel()).toBe('Auto')
})

// An arrow key that scrolls the page fires the hook's own scroll dismissal, so
// without preventDefault every attempt to walk the list would close the menu.
test('walking the list does not scroll the page out from under it', () => {
  open()

  const event = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    bubbles: true,
    cancelable: true,
  })
  document.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(screen.queryByRole('menu')).toBeTruthy()
})

test('an option is reachable by keyboard alone', () => {
  const onSelect = jest.fn()
  open({ options: options(onSelect) })

  fireEvent.keyDown(document, { key: 'End' })
  fireEvent.click(document.activeElement!)

  expect(onSelect).toHaveBeenCalledTimes(1)
  // selecting closes and hands focus back, so the next Tab resumes where the
  // user was rather than at the top of the document
  expect(screen.queryByRole('menu')).toBeNull()
  expect(document.activeElement).toBe(screen.getByLabelText('Track sizing'))
})

// The three dismissal routes. Each is a bug when missed and none of them shows
// up in a screenshot, which is the reason the hook owns them rather than leaving
// them to whoever writes the markup.
test('Escape closes and returns focus to the trigger', () => {
  open()
  fireEvent.keyDown(document, { key: 'Escape' })

  expect(screen.queryByRole('menu')).toBeNull()
  expect(document.activeElement).toBe(screen.getByLabelText('Track sizing'))
})

test('a press outside closes it', () => {
  open()
  fireEvent.pointerDown(document.body)

  expect(screen.queryByRole('menu')).toBeNull()
})

test('a press inside the menu does not', () => {
  // The dismissal listens on the document in the capture phase, so without the
  // containment check it would fire before the option's own click and the menu
  // would close under the pointer on its way to being used.
  open()
  fireEvent.pointerDown(screen.getByRole('menu'))

  expect(screen.queryByRole('menu')).toBeTruthy()
})

test('an ancestor scrolling closes it', () => {
  // The menu is `position: fixed` at coordinates measured off the trigger once,
  // at open time, so a scroll leaves it floating somewhere of its own. Fired on
  // the container rather than on document because a scroll event does not bubble
  // from an element — only the capture-phase listener sees this one, which is
  // the half that makes a scroll in *any* ancestor count.
  const { container } = render(
    <PlainTrackControl
      icon="height"
      tooltip="Track sizing"
      options={options()}
    />,
  )
  fireEvent.click(screen.getByLabelText('Track sizing'))
  expect(screen.queryByRole('menu')).toBeTruthy()

  fireEvent.scroll(container)
  expect(screen.queryByRole('menu')).toBeNull()
})

test('a control with no options opens no menu', () => {
  const onClick = jest.fn()
  render(
    <PlainTrackControl icon="filter" tooltip="Show only" onClick={onClick} />,
  )
  fireEvent.click(screen.getByLabelText('Show only'))

  expect(onClick).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('menu')).toBeNull()
})
