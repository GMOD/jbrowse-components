import { render, screen } from '@testing-library/react'

import plainChromeOverlays from './plainChromeOverlays.tsx'

// The plain set rendered directly, with no chrome above it.
//
// `plugins/linear-genome-view`'s suite of the same name drives these through
// `DisplayChromeBase` and a real MST fixture, which is what pins the phase
// routing and the terminal/overlay split. It cannot live here — the base is that
// plugin's, typed on `@jbrowse/render-core`'s backend. What belongs here is what
// the components themselves promise, since that is what an embedder consumes and
// what this package can break on its own.

const { Loading, BackgroundProgress } = plainChromeOverlays

test('the percentage is formatted by progressLabel, not by hand', () => {
  // The `X%` suffix is single-sourced in `@jbrowse/core/util/progress` so the
  // Material set and this one cannot round it differently. A third of a percent
  // is the case a hand-rolled `Math.round` gets right by accident and a
  // hand-rolled `toFixed` does not.
  render(<Loading model={{ statusProgress: 0.457 }} visible />)
  expect(screen.getByText('Loading 46%')).toBeTruthy()
})

test('an indeterminate load says so without a number', () => {
  render(<Loading model={{ statusMessage: 'Downloading' }} visible />)

  expect(screen.getByText('Downloading...')).toBeTruthy()
  // no fraction means no bar: a progressbar with no value announces nothing
  // useful and draws a permanently empty track
  expect(screen.queryByRole('progressbar')).toBeNull()
})

// Two elements, and the split is the whole point. A determinate status ticks
// about ten times a second, so a live region carrying the percentage talks over
// the rest of the page until the fetch ends; `aria-valuenow` on a progressbar is
// reachable on demand and silent as it changes.
test('the phase announces itself and the percentage stays quiet', () => {
  render(
    <Loading
      model={{ statusMessage: 'Downloading', statusProgress: 0.25 }}
      visible
    />,
  )

  const bar = screen.getByRole('progressbar')
  expect(bar.getAttribute('aria-valuenow')).toBe('25')
  expect(bar.getAttribute('aria-valuemax')).toBe('100')
  // the bar is outside the live region, and the live region is what carries the
  // phase text
  expect(screen.getByRole('status').textContent).toContain('Downloading 25%')
})

test('a fraction out of range still announces a value in range', () => {
  // `statusProgress` reaches these components off a model, and the aggregation
  // behind it sums totals reported by separate fetches — so a value above 1 is
  // an arithmetic result, not a caller error. Announcing 130% is worse than
  // clamping it.
  render(<Loading model={{ statusProgress: 1.3 }} visible />)
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
    '100',
  )
})

test('the background chip announces on the same terms as the scrim', () => {
  // The `ready`-phase status channel: same two-element split, because the work
  // behind it (clustering a cohort) reports just as densely.
  render(
    <BackgroundProgress
      model={{ statusMessage: 'Clustering samples', statusProgress: 0.5 }}
      visible
    />,
  )

  expect(screen.getByTestId('progress-chip').getAttribute('role')).toBe(
    'status',
  )
  expect(screen.getByText('Clustering samples 50%')).toBeTruthy()
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
    '50',
  )
})

test('a hidden state renders nothing at all', () => {
  // Both are mounted unconditionally and gate on `visible` themselves — the
  // scrim because its anti-flash delay is component state in the Material twin,
  // and this one for parity. A set that returned a hidden box instead would put
  // an empty live region on every track.
  const { container } = render(
    <Loading model={{ statusMessage: 'Downloading' }} visible={false} />,
  )
  expect(container.innerHTML).toBe('')
})
