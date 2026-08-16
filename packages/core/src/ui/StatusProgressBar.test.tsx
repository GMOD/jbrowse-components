import { render } from '@testing-library/react'

import StatusProgressBar from './StatusProgressBar.tsx'

// The bar was a MUI `LinearProgress` until it became the one Material component
// still rendering on pages whose host had asked for none. What follows is the
// contract that replacement has to keep — the toolkit-free assertion first,
// since that is the whole reason the component was rewritten and it is the one
// a well-meaning "just use LinearProgress" would break.

test('renders no Material UI', () => {
  const { container } = render(<StatusProgressBar fraction={0.42} />)

  expect(container.querySelector('[class*="Mui"]')).toBeNull()
})

test('a fraction fills that much of the track, and says so', () => {
  const { getByRole } = render(<StatusProgressBar fraction={0.42} />)
  const track = getByRole('progressbar')

  expect(track.getAttribute('aria-valuenow')).toBe('42')
  // scaled rather than sized, so a progress update is a compositor transform
  // instead of a layout
  expect(track.firstElementChild?.getAttribute('style')).toBe(
    'transform: scaleX(0.42);',
  )
})

test('a fraction outside 0..1 is clamped rather than overflowing the track', () => {
  const { getByRole } = render(<StatusProgressBar fraction={1.4} />)
  const track = getByRole('progressbar')

  expect(track.getAttribute('aria-valuenow')).toBe('100')
  expect(track.firstElementChild?.getAttribute('style')).toBe(
    'transform: scaleX(1);',
  )
})

test('no fraction is the indeterminate sweep, and claims no value', () => {
  const { getByRole } = render(<StatusProgressBar />)
  const track = getByRole('progressbar')

  // a progressbar with no `aria-valuenow` is how the platform spells
  // indeterminate; a 0 here would be read out as "0 percent" forever
  expect(track.getAttribute('aria-valuenow')).toBeNull()
  // no inline transform at all: the sweep is a keyframe animation on a
  // class, and an inline scaleX(0) would flatten it to nothing
  expect(track.firstElementChild?.getAttribute('style')).toBeNull()
})
