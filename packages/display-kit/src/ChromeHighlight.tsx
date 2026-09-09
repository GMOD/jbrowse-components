import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { hoverBoxStyle } from '@jbrowse/core/ui/hoverBoxStyle'
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
      return { border: '1.5px solid black', borderRadius: '50%' }
    default:
      return {
        background: strong ? palette.featureHoverStrong : palette.featureHover,
      }
  }
}

function Boxes({
  rects,
  testid,
  styleOf,
}: {
  rects: HighlightRect[]
  testid: string
  styleOf: (r: HighlightRect) => CSSProperties
}) {
  return rects.map((r, i) => (
    <div
      // eslint-disable-next-line @eslint-react/no-array-index-key -- geometry with no identity, rebuilt per hover
      key={i}
      data-testid={testid}
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        ...styleOf(r),
      }}
    />
  ))
}

/**
 * The on-screen hover and selection of a display answering `hoverInk`, drawn
 * by the chrome so no display places its own. A DOM element rather than
 * render state on purpose: the hovered instance moves on nearly every
 * mousemove, and a hover in the canvas's state repaints the whole display on
 * the Canvas2D fallback per move (`INTERACTION_PERF.md`). Its own observer,
 * so a hover re-renders these few divs and not the chrome around them.
 */
const ChromeHighlight = observer(function ChromeHighlight({
  model,
}: {
  model: HighlightHost
}) {
  const palette = usePalette()
  const { hoverInk, selectionInk = [], highlightStyle } = model
  return (
    <>
      <Boxes
        rects={selectionInk}
        testid="chrome-selection"
        styleOf={() => ({
          border: `2px solid ${palette.featureSelected}`,
          borderRadius: 3,
        })}
      />
      <Boxes
        rects={hoverInk}
        testid="chrome-hover"
        styleOf={r => hoverStyle(palette, highlightStyle, r.strong)}
      />
    </>
  )
})

export default ChromeHighlight
