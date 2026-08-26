import { createContext, use, useState } from 'react'

import { useMouseSelector } from './useMouseTracking.ts'

import type { MouseState, MouseTracker } from './useMouseTracking.ts'

/**
 * The pointer over the surface a view's highlight bands are positioned in — the
 * LinearGenomeView's tracks container, the DotplotView's plot area. Published by
 * whichever of those bound the handlers.
 *
 * A context rather than a prop because a band is often drawn by another plugin
 * through an extension point (grid-bookmark's bookmark bands), and those carry
 * only their `{ model }` props bag — the band families are siblings on screen
 * and would otherwise reach the pointer two different ways.
 */
const OverlayPointerContext = createContext<MouseTracker | undefined>(undefined)

export const OverlayPointerProvider = OverlayPointerContext.Provider

/**
 * The stripe a band occupies: an x span across a full-height band, a y span
 * across a full-width one. The other axis is the whole overlay, which is why it
 * isn't here.
 */
export type HighlightStripe =
  | { left: number; width: number }
  | { top: number; height: number }

function pointerInStripe(stripe: HighlightStripe, state: MouseState) {
  return 'left' in stripe
    ? state.x >= stripe.left && state.x < stripe.left + stripe.width
    : state.y >= stripe.top && state.y < stripe.top + stripe.height
}

/**
 * Whether a band should be drawing its chip, and the `setOpen` that keeps it
 * drawn while its menu is up.
 *
 * A band reveals its chip while the pointer is in its stripe, so the highlight's
 * menu is reachable where the highlight is rather than only from the view menu,
 * and a view full of bands is not also a view full of link icons. `persistent`
 * is the `showHighlightChips` pin, which a screenshot needs because nothing
 * hovers in one.
 *
 * The menu is the reason this owns state at all: it is portalled out of the
 * band, so opening it moves the pointer off the stripe that revealed it, and
 * unmounting the chip under an open menu takes the menu's own anchor with it.
 */
export function useHighlightChip(
  stripe: HighlightStripe | undefined,
  persistent: boolean,
) {
  const tracker = use(OverlayPointerContext)
  const [menuOpen, setMenuOpen] = useState(false)
  const hovered = useMouseSelector(
    tracker,
    state => !!state && !!stripe && pointerInStripe(stripe, state),
  )
  return { chipVisible: persistent || hovered || menuOpen, setMenuOpen }
}
