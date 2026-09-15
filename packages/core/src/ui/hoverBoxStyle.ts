import { alpha } from './palette.ts'

import type { CSSProperties } from 'react'

/**
 * The hover mark for a cell or block on a canvas display: a white wash plus a
 * dark border, never a color tint — the cell colors are the data, and a tint
 * washes them out.
 *
 * One definition because the alternative was proven to fail: `highlightBoxColors`
 * below exists for the same reason, after two backends drifted apart on their own
 * alpha literals kept in step by a comment.
 */
export const hoverBoxStyle: CSSProperties = {
  border: '1px solid rgba(0,0,0,0.5)',
  background: 'rgba(255,255,255,0.3)',
}

/**
 * The border and fill of a pinned highlight box, off the palette's highlight
 * hue. The chrome draws it on screen and `renderDisplaySvg` bakes it into the
 * export, so both reach one definition.
 *
 * JBrowse's own `alpha`, not Material UI's: the SVG export reaches this module
 * and should not drag @mui/material along.
 */
export function highlightBoxColors(highlightMain: string) {
  return {
    border: alpha(highlightMain, 0.9),
    fill: alpha(highlightMain, 0.25),
  }
}
