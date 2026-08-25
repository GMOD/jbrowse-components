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

  // A chip that opens a menu and a chip that acts are drawn alike, so the ▾ is
  // the only thing telling them apart — present exactly when there is a menu.
  it('marks a labelled control that opens a menu, and only that one', () => {
    const { unmount } = renderControl({
      icon: 'isoform',
      tooltip: 'tip',
      label: 'Longest isoform',
      options: options(() => {}),
    })
    const withMenu = screen.getByTestId('track-control-isoform')
    expect(withMenu.querySelectorAll('svg')).toHaveLength(2)
    unmount()

    renderControl({
      icon: 'filter',
      tooltip: 'tip',
      label: '3 selected',
      onClick: () => {},
    })
    expect(
      screen.getByTestId('track-control-filter').querySelectorAll('svg'),
    ).toHaveLength(1)
  })

  // The isoform notice treats the menu having been opened as the notice having
  // been read, and hears about it here. On close rather than open, because the
  // chip shrinking while its menu is up takes the menu's anchor with it.
  it('reports the menu closing after a pick', () => {
    const onMenuClose = jest.fn()
    renderControl({
      icon: 'isoform',
      tooltip: 'tip',
      label: 'Longest isoform',
      onMenuClose,
      options: options(() => {}),
    })
    fireEvent.click(screen.getByText('Longest isoform'))
    expect(onMenuClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('All transcripts'))
    expect(onMenuClose).toHaveBeenCalledTimes(1)
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

// The controls sit on the rendered canvas, so a translucent hover state lets
// features show through the control — a chip that looks like it is dissolving
// as you reach for it. Material UI's own hover colors are exactly that, and
// Chip's carries two classes, so what matters is which rule *wins*: this asks
// the cascade rather than trusting the declaration we wrote.
describe.each([
  ['icon-button', { icon: 'height', tooltip: 'Track sizing' }],
  ['chip', { icon: 'height', tooltip: 'Track sizing', label: 'Fit to height' }],
] as const)('Material UI hover — %s form', (_name, props) => {
  it('stays opaque', () => {
    renderMui({ ...props, options: options(() => {}) })
    const element = screen.getByTestId('track-control-height')
    // emotion inserts through the CSSOM here, so the <style> tag's text is
    // empty and the rules have to be read off the sheet
    const applicable = [...document.styleSheets]
      .flatMap(sheet => [...sheet.cssRules])
      .filter((rule): rule is CSSStyleRule => 'selectorText' in rule)
      .filter(
        rule =>
          rule.selectorText.endsWith(':hover') &&
          element.matches(rule.selectorText.replaceAll(':hover', '')),
      )
    const specificity = (rule: CSSStyleRule) =>
      rule.selectorText.split('.').length
    const rank = Math.max(...applicable.map(specificity))
    const winner = applicable.filter(rule => specificity(rule) === rank).at(-1)
    expect(winner).toBeDefined()
    expect(
      winner!.style.background || winner!.style.backgroundColor,
    ).not.toMatch(/rgba|transparent|color-mix/)
  })
})
