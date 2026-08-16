import BaseTooltip from './BaseTooltip.tsx'

import type { MouseState } from './useMouseTracking.ts'
import type React from 'react'

/**
 * `BaseTooltip` anchored to the chrome's pointer measurement, drawn only when
 * there is both a hit and a pointer.
 *
 * Five display tooltips opened with the same three lines — read the hover, bail
 * if either half is missing, mount `BaseTooltip` at
 * `{ x: clientX, y: clientY }` — and the guard is the part worth single-sourcing
 * rather than the markup: `mouseState` is `undefined` after a leave *and* on the
 * first render after a terminal banner clears (`DisplayChromeBase` flushes the
 * tracker for exactly that case), so a tooltip that checks only its hit paints
 * at whatever coordinate the pointer last had.
 *
 * The body stays each display's own — a wiggle bin, a SNP and a genotype cell
 * have nothing to share below this line.
 *
 * Deep-imported, never through the `@jbrowse/core/ui` barrel, for the reason
 * `BaseTooltip` is: it reaches @floating-ui (~266KB) and that barrel is on the
 * eager plugin-entry path.
 */
export default function HoverTooltip({
  hit,
  mouseState,
  children,
}: {
  /** The display's hover. Nothing is drawn when it is absent. */
  hit: unknown
  mouseState: MouseState | undefined
  children: React.ReactNode
}) {
  return hit && mouseState ? (
    <BaseTooltip clientPoint={{ x: mouseState.clientX, y: mouseState.clientY }}>
      {children}
    </BaseTooltip>
  ) : null
}
