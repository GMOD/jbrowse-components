import {
  flip,
  offset,
  shift,
  useClientPoint,
  useFloating,
  useInteractions,
} from '@floating-ui/react'
import { Portal, useTheme } from '@mui/material'

import { usePalette } from './PaletteContext.tsx'
import { alpha, grey } from './palette.ts'
import { TOOLTIP_Z_INDEX } from './zIndexes.ts'

// The hover tooltip every display shares.
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

// The gap between the cursor and the tooltip, and the ONLY place it is decided.
// `offset()` applies it along the resolved placement axis, so it stays a gap
// when `flip()` puts the tooltip to the LEFT of the cursor near the right edge
// of the viewport.
//
// Callers pass the pointer's true client point. Eight of them used to add 5, 10
// or 15 to `x` themselves on top of this, so the same affordance sat 20, 25 or
// 30px from the cursor depending on which track you hovered — nobody chose
// that, and a nudge baked into the coordinate moves the reference point rather
// than the tooltip, so on a flipped placement it pushed the tooltip *toward*
// the cursor instead of away. Don't reintroduce one; change this number.
const CURSOR_GAP_PX = 15

export default function BaseTooltip({
  clientPoint: clientPointCoords,
  children,
  placement = 'right',
}: {
  placement?:
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
  clientPoint?: { x: number; y: number }
  children: React.ReactNode
}) {
  // the theme is read for one thing only: the portal container a shadow-DOM
  // embed configures through `MuiPopper.defaultProps.container`, which every
  // other portaled thing in JBrowse honours too. It contributes no styling.
  const theme = useTheme()
  const popperTheme = theme.components?.MuiPopper
  const palette = usePalette()
  const { refs, floatingStyles, context } = useFloating({
    placement,
    strategy: 'fixed',
    // flip/shift keep the tooltip on-screen when the cursor is near a viewport
    // edge instead of letting it clip off the right/bottom
    middleware: [offset(CURSOR_GAP_PX), flip(), shift({ padding: 8 })],
  })

  const clientPoint = useClientPoint(context, clientPointCoords)
  const { getFloatingProps } = useInteractions([clientPoint])
  return (
    <Portal container={popperTheme?.defaultProps?.container}>
      <div
        ref={refs.setFloating}
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
      </div>
    </Portal>
  )
}
