import { render } from '@testing-library/react'

import { TrackOverlayPortal } from './TrackOverlayPortal.tsx'
import { TrackOverlaySlot } from './TrackOverlaySlot.tsx'

// The slot and the portal are two ends of one rule, and the rule is a paint
// order: a display's chrome has to escape the `contain: strict` sandbox that
// isolates its paint, because the stacking context that isolation creates is
// what stops the chrome out-z-indexing anything drawn over the track stack.
//
// Pinned here because the failure is silent. Nothing throws when the context is
// missing — `TrackOverlayPortal` falls back to rendering inline, which looks
// correct until something is painted over it, and then looks like a rendering
// bug in whatever got buried rather than a missing provider.

const Chrome = () => (
  <TrackOverlayPortal>
    <div data-testid="chrome">a legend</div>
  </TrackOverlayPortal>
)

test('chrome portals into the overlay node, not inline beside the display', () => {
  const { getByTestId } = render(
    <TrackOverlaySlot zIndex={3}>
      <div data-testid="sandbox">
        <Chrome />
      </div>
    </TrackOverlaySlot>,
  )

  const chrome = getByTestId('chrome')
  // the whole point: it is NOT inside the box the display was mounted in
  expect(getByTestId('sandbox').contains(chrome)).toBe(false)
  expect(chrome.parentElement?.style.position).toBe('absolute')
})

test('the overlay node paints where the caller says and eats no events', () => {
  const { getByTestId } = render(
    <TrackOverlaySlot zIndex={42}>
      <Chrome />
    </TrackOverlaySlot>,
  )

  const node = getByTestId('chrome').parentElement!
  expect(node.style.zIndex).toBe('42')
  // it covers the display's box, so without this it would swallow every click
  // meant for the canvas underneath
  expect(node.style.pointerEvents).toBe('none')
})

// The marker is on the node rather than on each panel, so chrome that takes
// pointer events back is exempt from the LGV's click-drag pan by construction —
// see `useSideScroll`, which tests `closest('[data-gesture-owner]')`.
test('the overlay node claims the press for everything in it', () => {
  const { getByTestId } = render(
    <TrackOverlaySlot zIndex={3}>
      <Chrome />
    </TrackOverlaySlot>,
  )

  expect(getByTestId('chrome').closest('[data-gesture-owner]')).not.toBeNull()
})

// `overlayStyle` exists for exactly one caller (TrackContainer cancelling its
// Paper border), and it has to be able to beat the defaults or it buys nothing.
test('overlayStyle overrides the placement defaults', () => {
  const { getByTestId } = render(
    <TrackOverlaySlot zIndex={3} overlayStyle={{ left: -1 }}>
      <Chrome />
    </TrackOverlaySlot>,
  )

  expect(getByTestId('chrome').parentElement?.style.left).toBe('-1px')
})

// Without a slot above it the portal renders in place. That is the documented
// fallback and it is what every host that has not adopted the slot gets, so it
// is pinned rather than left to be discovered as a regression.
test('with no slot the portal falls back to rendering inline', () => {
  const { getByTestId } = render(
    <div data-testid="sandbox">
      <Chrome />
    </div>,
  )

  expect(getByTestId('sandbox').contains(getByTestId('chrome'))).toBe(true)
})
