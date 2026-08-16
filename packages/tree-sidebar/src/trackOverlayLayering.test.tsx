import { TrackOverlayContext } from '@jbrowse/display-ui'
import { render } from '@testing-library/react'

import { RowLabelsOverlay } from './RowLabelsOverlay.tsx'

/**
 * The sidebar's painted half has to leave the display's `contain: strict` sandbox
 * or the LGV's inter-region masks paint over it — a grey separator bar through
 * the row labels at every region boundary. Nothing about that is visible from
 * inside the components, so it regresses silently: drop the portal and every
 * test still passes, because the fallback renders in place.
 *
 * These assert the escape itself. See the package CLAUDE.md for why the
 * hit-test layer deliberately does NOT escape.
 */
describe('sidebar chrome escapes the display sandbox', () => {
  const props = {
    sources: [{ name: 'a' }, { name: 'b' }],
    rowHeight: 20,
    labelOffset: 0,
    width: 400,
    height: 40,
    testId: 'labels',
  }

  it('renders the row labels into the track overlay node, not in place', () => {
    const overlay = document.createElement('div')
    document.body.append(overlay)
    const { container, getByTestId } = render(
      <TrackOverlayContext value={overlay}>
        <RowLabelsOverlay {...props} />
      </TrackOverlayContext>,
    )
    expect(overlay.contains(getByTestId('labels'))).toBe(true)
    expect(container.contains(getByTestId('labels'))).toBe(false)
  })

  // A display used outside a TrackContainer (some tests, embedded standalone
  // use) has no node to portal into, and must still draw its labels.
  it('falls back to rendering in place with no overlay node', () => {
    const { container, getByTestId } = render(
      <TrackOverlayContext value={null}>
        <RowLabelsOverlay {...props} />
      </TrackOverlayContext>,
    )
    expect(container.contains(getByTestId('labels'))).toBe(true)
  })

  // maf stacks coverage/conservation bands above its rows, and the portal lands
  // on the display's origin rather than the rows container the labels used to
  // sit in — so the offset it inherited has to be passed explicitly. Without it
  // the labels detach from the rows they name by exactly the band height.
  it('honors the top offset a display passes for its rows viewport', () => {
    const { getByTestId } = render(<RowLabelsOverlay {...props} top={45} />)
    expect(getByTestId('labels').style.top).toBe('45px')
  })

  it('sits at the display origin when no offset is given', () => {
    const { getByTestId } = render(<RowLabelsOverlay {...props} />)
    expect(getByTestId('labels').style.top).toBe('0px')
  })
})
