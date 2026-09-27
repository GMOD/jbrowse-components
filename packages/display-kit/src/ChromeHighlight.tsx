import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import {
  highlightBoxColors,
  hoverBoxStyle,
} from '@jbrowse/core/ui/hoverBoxStyle'
import { alpha } from '@jbrowse/core/ui/palette'
import { observer } from 'mobx-react'

import type { HighlightHost, HighlightRect } from './highlightHost.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { CSSProperties } from 'react'

function hoverStyle(
  palette: JBrowsePalette,
  style: HighlightHost['highlightStyle'],
  strong: boolean | undefined,
): CSSProperties {
  switch (style) {
    case 'box':
      return hoverBoxStyle
    case 'ring':
      return {
        border: `1.5px solid ${palette.text.primary}`,
        borderRadius: '50%',
      }
    default:
      return {
        background: strong ? palette.featureHoverStrong : palette.featureHover,
      }
  }
}

/** How a list's stroked ink reads: its colour, drawn this much wider than the ink. */
interface StrokeStyle {
  color: string
  widenPx: number
  dash?: string
}

function Boxes({
  rects,
  testid,
  styleOf,
  strokeOf,
}: {
  rects: HighlightRect[]
  testid: string
  styleOf: (r: HighlightRect) => CSSProperties
  strokeOf: (r: HighlightRect) => StrokeStyle
}) {
  return rects.map((r, i) => {
    const box = {
      position: 'absolute',
      pointerEvents: 'none',
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
    } as const
    if (r.stroke) {
      const { color, widenPx, dash } = strokeOf(r)
      const pad = widenPx / 2
      return (
        <svg
          // eslint-disable-next-line @eslint-react/no-array-index-key -- geometry with no identity, rebuilt per hover
          key={i}
          data-testid={testid}
          style={{
            ...box,
            left: r.left - pad,
            top: r.top - pad,
            width: r.width + 2 * pad,
            height: r.height + 2 * pad,
            overflow: 'hidden',
          }}
        >
          <path
            d={r.stroke.d}
            transform={`translate(${r.stroke.originX - r.left + pad} ${r.stroke.originY - r.top + pad})`}
            fill="none"
            stroke={color}
            strokeWidth={r.stroke.widthPx + widenPx}
            strokeDasharray={dash}
          />
        </svg>
      )
    }
    return (
      <div
        // eslint-disable-next-line @eslint-react/no-array-index-key -- geometry with no identity, rebuilt per hover
        key={i}
        data-testid={testid}
        style={{ ...box, ...styleOf(r) }}
      />
    )
  })
}

/**
 * The on-screen boxes of a display answering `hoverInk`, drawn by the chrome so
 * no display places its own: the solo collection under the pinned boxes, those
 * under the selection, that under the hover. A DOM element rather than
 * render state on purpose: the hovered instance moves on nearly every
 * mousemove, and a hover in the canvas's state repaints the whole display on
 * the Canvas2D fallback per move, re-rasterizing every base of a pileup
 * (ADR-110). Its own observer, so a hover re-renders these few divs and not
 * the chrome around them.
 */
const ChromeHighlight = observer(function ChromeHighlight({
  model,
}: {
  model: HighlightHost
}) {
  const palette = usePalette()
  const {
    hoverInk,
    selectionInk = [],
    pinnedInk = [],
    soloInk = [],
    highlightStyle,
  } = model
  const pinned = highlightBoxColors(palette.highlight.main)
  return (
    <>
      <Boxes
        rects={soloInk}
        testid="chrome-solo"
        styleOf={() => ({
          border: `2px dashed ${palette.accent}`,
          borderRadius: 3,
          backgroundColor: alpha(palette.accent, 0.15),
        })}
        strokeOf={() => ({ color: palette.accent, widenPx: 3, dash: '6 3' })}
      />
      <Boxes
        rects={pinnedInk}
        testid="chrome-pinned"
        styleOf={() => ({
          border: `1px solid ${pinned.border}`,
          borderRadius: 3,
          backgroundColor: pinned.fill,
        })}
        strokeOf={() => ({ color: pinned.border, widenPx: 4 })}
      />
      <Boxes
        rects={selectionInk}
        testid="chrome-selection"
        styleOf={() => ({
          border: `2px solid ${palette.featureSelected}`,
          borderRadius: 3,
        })}
        strokeOf={() => ({ color: palette.featureSelected, widenPx: 3 })}
      />
      <Boxes
        rects={hoverInk}
        testid="chrome-hover"
        styleOf={r => hoverStyle(palette, highlightStyle, r.strong)}
        strokeOf={() => ({ color: palette.featureHoverStrong, widenPx: 3 })}
      />
    </>
  )
})

export default ChromeHighlight
