import { useMouseState } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import type { MouseState, MouseTracker } from '@jbrowse/core/ui'
import type { ReactNode } from 'react'

/**
 * The layer that follows the pointer, and nothing else: reads the chrome's
 * tracker with `useMouseState` in a component of its own, so a tooltip or a
 * guide re-renders on a move while the body beside it does not. Render the
 * content from the callback, which runs inside this observer, so a model read
 * in it is tracked here.
 */
export const PointerLayer = observer(function PointerLayer({
  mouseTracker,
  children,
}: {
  mouseTracker: MouseTracker
  children: (mouseState: MouseState | undefined) => ReactNode
}) {
  return children(useMouseState(mouseTracker))
})
