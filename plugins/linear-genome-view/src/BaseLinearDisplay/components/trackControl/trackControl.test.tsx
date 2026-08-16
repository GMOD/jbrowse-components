import { createJBrowseTheme } from '@jbrowse/core/ui'
import { TrackControlProvider, plainTrackControl } from '@jbrowse/display-ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import TrackControl from './TrackControl.tsx'

import type { TrackControlProps } from '@jbrowse/display-ui'

// The two implementations are held to the same behavioral bar here on purpose:
// an embedder who swaps in `plainTrackControl` is trusting that the control
// still *works*, not just that it stops being Material UI. Anything one of them
// can do that the other cannot is a bug in the seam.

function options(onSelect: () => void) {
  return [
    { label: 'Auto', selected: true, onSelect: () => {} },
    { label: 'All transcripts', selected: false, onSelect },
  ]
}

function renderMui(props: TrackControlProps) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <TrackControl {...props} />
    </ThemeProvider>,
  )
}

function renderPlain(props: TrackControlProps) {
  return render(
    <TrackControlProvider value={plainTrackControl}>
      <TrackControl {...props} />
    </TrackControlProvider>,
  )
}

describe.each([
  ['default (Material UI)', renderMui],
  ['plainTrackControl', renderPlain],
])('TrackControl — %s', (_name, renderControl) => {
  it('shows the label and opens its options', () => {
    const onSelect = jest.fn()
    renderControl({
      icon: 'isoform',
      tooltip: 'tip',
      label: 'Longest isoform',
      options: options(onSelect),
    })
    fireEvent.click(screen.getByText('Longest isoform'))
    fireEvent.click(screen.getByText('All transcripts'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('fires onDelete from the (×) without firing the control itself', () => {
    const onDelete = jest.fn()
    const onSelect = jest.fn()
    renderControl({
      icon: 'filter',
      tooltip: 'tip',
      label: '3 selected',
      onDelete,
      options: options(onSelect),
    })
    // the (×) is an svg inside the chip in one set and a sibling button in the
    // other, so the shared testid is the only handle that finds both
    fireEvent.click(screen.getByTestId('track-control-dismiss'))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('explains itself with no label to read', () => {
    // The icon-only form is the one an unfamiliar user meets first, and the
    // tooltip is the only thing it says. Reachable as an accessible name in
    // both sets, so a screen reader gets what the hover gets.
    renderControl({
      icon: 'height',
      tooltip: 'Track sizing',
      options: options(() => {}),
    })
    expect(screen.getByLabelText('Track sizing')).toBeTruthy()
  })
})

describe('plainTrackControl', () => {
  it('renders no Material UI', () => {
    const { container, baseElement } = renderPlain({
      icon: 'height',
      tooltip: 'Track sizing',
      label: 'Fit to height',
      onDelete: () => {},
      options: options(() => {}),
    })
    fireEvent.click(screen.getByText('Fit to height'))
    // baseElement, not container: the open menu is portaled to document.body,
    // which is exactly where a stray toolkit would hide
    expect(container.querySelectorAll('[class*="Mui"]')).toHaveLength(0)
    expect(baseElement.querySelectorAll('[class*="Mui"]')).toHaveLength(0)
    expect(screen.getByRole('menu')).toBeTruthy()
  })
})

// Its dismissal routes, its keyboard and its focus handling are pinned in
// `@jbrowse/display-ui`'s own `plainTrackControl.test.tsx`, next to the hook
// that implements them. What has to be tested *here* is the seam: that the two
// implementations behave alike, and that swapping one in leaks no Material UI
// through the resolver. Restating the dismissal cases in both packages only
// buys two places to update them.
