// deep subpath, never the `@jbrowse/core/ui` barrel: this package reaches no
// UI toolkit, and the barrel pulls MUI in
import { useMouseState } from '@jbrowse/core/ui/useMouseTracking'
import { observer } from 'mobx-react'

import type {
  MouseState,
  MouseTracker,
} from '@jbrowse/core/ui/useMouseTracking'
import type { ReactNode } from 'react'

/**
 * The part of a display that follows the pointer, in a leaf of its own so a
 * mousemove re-renders this and not the chrome, its status container and every
 * overlay under it (see `useMouseTracking`). An observer, so a model read in
 * `children` is tracked here too rather than freezing under a stationary
 * cursor.
 *
 * `inRows` is whether the pointer is past `rowsTopOffset`, the bands a display
 * stacks above its rows — a crosshair drawn over one names a row the pointer is
 * not on, and `>=` because the rows begin AT the offset. A tooltip usually
 * wants it ungated, which is why the child decides, and `children` is handed an
 * absent state so a layer that draws with nothing hovered still can.
 */
export const PointerLayer = observer(function PointerLayer({
  mouseTracker,
  rowsTopOffset = 0,
  children,
}: {
  mouseTracker: MouseTracker
  rowsTopOffset?: number
  children: (state: MouseState | undefined, inRows: boolean) => ReactNode
}) {
  const state = useMouseState(mouseTracker)
  return children(state, !!state && state.y >= rowsTopOffset)
})
