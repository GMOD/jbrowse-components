import { createContext, use, useState } from 'react'

import { useMouseSelector } from '@jbrowse/core/ui/useMouseTracking'

import type { MouseTracker } from '@jbrowse/core/ui/useMouseTracking'

/**
 * The pointer over the tracks area, measured against the box the highlight
 * bands are positioned in (TracksContainer publishes it).
 *
 * A context rather than a prop because the bookmark bands are drawn by the
 * grid-bookmark plugin through the `LinearGenomeView-TracksContainerComponent`
 * extension point, which has only its `{ model }` props bag to hand things
 * through — the two band families are siblings on screen and would otherwise
 * reach the pointer two different ways.
 */
const TracksPointerContext = createContext<MouseTracker | undefined>(undefined)

export const TracksPointerProvider = TracksPointerContext.Provider

/**
 * Whether a band should be drawing its chip, and the `setOpen` that keeps it
 * drawn while its menu is up.
 *
 * A band reveals its chip while the pointer is anywhere in its column, so the
 * highlight's menu is reachable where the highlight is rather than only from the
 * view menu, and a view full of bands is not also a view full of link icons.
 * `persistent` is the `showHighlightChips` pin, which a screenshot needs because
 * nothing hovers in one.
 *
 * The menu is the reason this owns state at all: it is portalled out of the
 * band, so opening it moves the pointer off the column that revealed it, and
 * unmounting the chip under an open menu takes the menu's own anchor with it.
 */
export function useHighlightChip(
  coords: { left: number; width: number } | undefined,
  persistent: boolean,
) {
  const tracker = use(TracksPointerContext)
  const [menuOpen, setMenuOpen] = useState(false)
  const hovered = useMouseSelector(
    tracker,
    state =>
      !!state &&
      !!coords &&
      state.x >= coords.left &&
      state.x < coords.left + coords.width,
  )
  return { chipVisible: persistent || hovered || menuOpen, setMenuOpen }
}
