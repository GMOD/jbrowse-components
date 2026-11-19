import { useEffect, useState } from 'react'

import {
  autoUpdate,
  flip,
  offset,
  shift,
  useClientPoint,
  useFloating,
  useInteractions,
} from '@floating-ui/react'
import { observer } from 'mobx-react'
import { createPortal } from 'react-dom'

import { useStyleTheme } from './PaletteContext.tsx'
import { alpha, grey } from './palette.ts'
import { TOOLTIP_Z_INDEX } from './zIndexes.ts'

// The hover tooltip every display shares, following the pointer
// (`clientPoint`) or hanging off a hovered control (`anchor`). Styled from the
// palette with inline styles, not a MUI-themed `makeStyles`, so a host using
// `plainChromeOverlays` renders no Material UI. Dark in both modes; the font
// is inherited from where it is portaled, the size stated.
const tooltipBaseStyle = {
  pointerEvents: 'none',
  borderRadius: 4,
  fontFamily: 'inherit',
  fontSize: 12,
  padding: '4px 8px',
  lineHeight: 1.4,
  maxWidth: 300,
  wordWrap: 'break-word',
} as const

// `offset()` applies the gap along the resolved placement, so it stays a gap
// after `flip()`. Callers pass the true client point; never nudge it, since a
// nudged point moves toward the cursor on a flipped placement.
const CURSOR_GAP_PX = 15

// Where the pointer last was, app-wide. A hover tooltip mounts because the
// pointer already arrived, and floating-ui's own follow mode only learns of the
// next move, so a tooltip without `clientPoint` would stay hidden until then.
let lastPointerPoint: { x: number; y: number } | undefined

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointermove',
    event => {
      lastPointerPoint = { x: event.clientX, y: event.clientY }
    },
    { passive: true, capture: true },
  )
}

const ANCHOR_GAP_PX = 6

export type TooltipPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'right'
  | 'right-start'
  | 'right-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'

const BaseTooltip = observer(function BaseTooltip({
  clientPoint: clientPointCoords,
  anchor,
  id,
  children,
  placement = anchor ? 'top' : 'right',
}: {
  placement?: TooltipPlacement
  /** Follow the pointer. The cursor-anchored mode, and the older of the two. */
  clientPoint?: { x: number; y: number }
  /**
   * Hang off an element instead — what a control's hover label wants, where
   * following the cursor across a button reads as a stray box. Mutually
   * exclusive with `clientPoint`; `@jbrowse/display-ui`'s `useTooltip` is what
   * drives this arm.
   */
  anchor?: HTMLElement
  /** For a trigger pointing at this with `aria-describedby`. */
  id?: string
  children: React.ReactNode
}) {
  // The style theme is read for two things and neither is a Material import:
  // the colors below, and the portal container a shadow-DOM embed configures
  // through `MuiPopper.defaultProps.container` — the same slot every other
  // portaled thing in JBrowse honours, lifted onto the style theme by
  // `resolveStyleTheme` so reading it here costs no UI toolkit.
  const { palette, portalContainer } = useStyleTheme()
  const { refs, floatingStyles, context } = useFloating({
    placement,
    strategy: 'fixed',
    elements: { reference: anchor },
    // flip/shift keep the tooltip on-screen when the reference is near a
    // viewport edge instead of letting it clip off the right/bottom — and a
    // control with a hover label is usually in a corner, so this arm needs it
    // at least as much as the cursor one
    middleware: [
      offset(anchor ? ANCHOR_GAP_PX : CURSOR_GAP_PX),
      flip(),
      shift({ padding: 8 }),
    ],
    // An anchored tooltip is measured against an element that scrolls with the
    // track under it, so its position is followed. A cursor-anchored one is
    // remeasured by every pointer move anyway.
    whileElementsMounted: anchor ? autoUpdate : undefined,
  })

  // Follow the pointer here, rather than handing floating-ui its own follow
  // mode, so the tooltip opens AT a point instead of at nothing — see
  // `lastPointerPoint`. A caller that named a point, or an element, owns the
  // position outright and this stays out of the way.
  const [tracked, setTracked] = useState(lastPointerPoint)
  const following = !anchor && clientPointCoords === undefined
  useEffect(() => {
    if (!following) {
      return undefined
    }
    setTracked(lastPointerPoint)
    const onMove = (event: PointerEvent) => {
      setTracked({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('pointermove', onMove, {
      passive: true,
      capture: true,
    })
    return () => {
      window.removeEventListener('pointermove', onMove, true)
    }
  }, [following])

  // `enabled` rather than a conditional hook: with an element reference in
  // play, letting this also write one would leave the two arms fighting over
  // the same slot.
  const clientPoint = useClientPoint(context, {
    ...(clientPointCoords ?? tracked),
    enabled: !anchor,
  })
  const { getFloatingProps } = useInteractions([clientPoint])

  // `document.body` is the default, which is what MUI's `Portal` did. Resolved
  // at render rather than in an effect: a tooltip only ever mounts in response
  // to a pointer, so there is no first paint to be wrong about and no
  // hydration pass to mismatch — but the `document` guard stays, because this
  // module is reachable from a server render even when this component is not.
  const target =
    (typeof portalContainer === 'function'
      ? portalContainer()
      : portalContainer) ??
    (typeof document === 'undefined' ? undefined : document.body)
  if (!target) {
    return null
  }

  return createPortal(
    <div
      id={id}
      ref={refs.setFloating}
      role="tooltip"
      style={{
        ...tooltipBaseStyle,
        backgroundColor: alpha(grey[700], 0.9),
        color: palette.common.white,
        // after the base style, so the strategy's `position: fixed` wins
        ...floatingStyles,
        zIndex: TOOLTIP_Z_INDEX,
        // workaround for tooltips flashing at top left corner of screen
        // when first appearing
        visibility:
          floatingStyles.transform === 'translate(0px, 0px)'
            ? 'hidden'
            : undefined,
      }}
      {...getFloatingProps()}
    >
      {children}
    </div>,
    target,
  )
})

export default BaseTooltip
