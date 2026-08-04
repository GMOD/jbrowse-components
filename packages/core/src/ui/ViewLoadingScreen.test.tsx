import { render } from '@testing-library/react'

import ViewLoadingScreen from './ViewLoadingScreen.tsx'

// The point of this screen is to answer "is the app hung, or is it downloading
// something?" — so what's pinned here is that the phase label reaches the DOM,
// and that a determinate status draws an actual bar rather than silently
// degrading to the same animated ellipses an indeterminate one shows.

test('shows the phase label, with the percent when determinate', () => {
  const { container } = render(
    <ViewLoadingScreen
      message="Downloading chromosome aliases"
      fraction={0.42}
    />,
  )
  expect(container.textContent).toContain('Downloading chromosome aliases 42%')

  const bar = container.querySelector('[role="progressbar"]')
  expect(bar).not.toBeNull()
  // determinate: MUI reports the filled fraction, which is what distinguishes
  // this from the indeterminate case below
  expect(bar!.getAttribute('aria-valuenow')).toBe('42')
})

test('an indeterminate phase keeps the label and drops the bar', () => {
  const { container } = render(
    <ViewLoadingScreen message="Downloading 2bit header" />,
  )
  expect(container.textContent).toContain('Downloading 2bit header')
  expect(container.textContent).not.toContain('%')
  expect(container.querySelector('[role="progressbar"]')).toBeNull()
})

test('falls back to a bare Loading when nothing has reported yet', () => {
  const { container } = render(<ViewLoadingScreen />)
  expect(container.textContent).toContain('Loading')
})
