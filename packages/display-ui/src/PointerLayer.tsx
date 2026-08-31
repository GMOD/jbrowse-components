// deep subpath, never the `@jbrowse/core/ui` barrel: this package reaches no
// UI toolkit, and the barrel pulls MUI in
import { useMouseState } from '@jbrowse/core/ui/useMouseTracking'

import type {
  MouseState,
  MouseTracker,
} from '@jbrowse/core/ui/useMouseTracking'
import type { ReactNode } from 'react'

/**
 * The part of a display that follows the pointer — guides, a tooltip, a
 * highlighted column — rendered off the chrome's `mouseTracker` in a leaf of
 * its own, so a mousemove re-renders this and nothing else. Read in the
 * component that mounts `DisplayChrome` instead, the position would re-render
 * the chrome, its status container and every overlay under it on each move
 * (see `useMouseTracking`).
 *
 * `rowsTopOffset` answers whether the pointer is over the rows rather than a
 * band stacked above them, for a display that gates its crosshair to the rows:
 * a guide drawn while the pointer is over a variant lane or a connector zone
 * names a row the pointer is not on. The tooltip is usually not gated with it,
 * which is why the child decides. `children` is also handed an absent state, so
 * a layer that has to render while nothing is hovered — the matrix display's
 * connector lines, with no column highlighted — can.
 *
 * Four displays used to write this component out, with the same paragraph over
 * each.
 */
export function PointerLayer({
  mouseTracker,
  rowsTopOffset = 0,
  children,
}: {
  mouseTracker: MouseTracker
  rowsTopOffset?: number
  children: (state: MouseState | undefined, inRows: boolean) => ReactNode
}) {
  // >=: the rows begin AT the offset (their container sits at
  // `top: rowsTopOffset`), so the boundary pixel is row 0's top edge — and with
  // no band above, y=0 is the display's own top edge, not a dead line.
  const state = useMouseState(mouseTracker)
  return <>{children(state, !!state && state.y >= rowsTopOffset)}</>
}
