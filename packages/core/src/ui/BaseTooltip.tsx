import {
  autoUpdate,
  flip,
  offset,
  shift,
  useClientPoint,
  useFloating,
  useInteractions,
} from '@floating-ui/react'
import { createPortal } from 'react-dom'

import { useStyleTheme } from './PaletteContext.tsx'
import { alpha, grey } from './palette.ts'
import { TOOLTIP_Z_INDEX } from './zIndexes.ts'

// The hover tooltip every display shares, in both of its anchorings: following
// the pointer over a display's data (`clientPoint`, what the ten display
// tooltips use through `HoverTooltip`), or hanging off a control that was
// hovered (`anchor`, what `@jbrowse/display-ui`'s `Tooltip` drives). One
// component rather than two, because the second one only ever differed in which
// reference it positioned against — everything below this line was the part
// worth having once.
//
// Its look comes from the palette and plain inline styles rather than from a
// `makeStyles` reading the Material UI theme, and that is deliberate: an
// embedder who installs `plainChromeOverlays` + `plainTrackControl` gets stock
// displays that render no Material UI, and a tooltip carrying the MUI *default*
// theme's grey and Roboto (which is what it did, since such a host mounts no
// ThemeProvider) put a Material widget back on their screen. It was invisible
// to `jbrowse-build-your-own`'s smoke census too, which counts `Mui*`
// classnames and never sees an emotion class.
//
// The chip is dark in both palette modes, the way a tooltip conventionally is.
// It is the one thing on screen that deliberately does not match the page.
//
// `fontFamily: inherit` puts it in whatever font it is portaled into: Roboto in
// JBrowse's own products, whose `CssBaseline` sets the body font, and the
// host's font in an embed. The size is stated rather than inherited, because
// body text is a good deal larger than a tooltip should be.
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

// The gap between the reference and the tooltip, and the ONLY place it is
// decided. `offset()` applies it along the resolved placement axis, so it stays
// a gap when `flip()` puts the tooltip to the LEFT of the cursor near the right
// edge of the viewport.
//
// Callers pass the pointer's true client point. Eight of them used to add 5, 10
// or 15 to `x` themselves on top of this, so the same affordance sat 20, 25 or
// 30px from the cursor depending on which track you hovered — nobody chose
// that, and a nudge baked into the coordinate moves the reference point rather
// than the tooltip, so on a flipped placement it pushed the tooltip *toward*
// the cursor instead of away. Don't reintroduce one; change this number.
const CURSOR_GAP_PX = 15

// An element is its own size, so the gap is measured from its edge rather than
// from a point the pointer happens to be at. 15px off a button reads as a
// tooltip belonging to nothing in particular.
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

export default function BaseTooltip({
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

  // `enabled` rather than a conditional hook: with an element reference in
  // play, letting this also write one would leave the two arms fighting over
  // the same slot.
  const clientPoint = useClientPoint(context, {
    ...clientPointCoords,
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
}
