import { RowSeparatorLines } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

interface SeparatorModel {
  isOverlay: boolean
  isDensityMode: boolean
  showRowSeparators: boolean
  numRows: number
  effectiveRowHeight: number
}

// Inter-row separator lines, shared by the live MultiWiggleComponent and the
// SVG export so the two can't drift. Both callers render this inside an <svg>,
// so it emits bare <line> fragments and takes the content width explicitly
// (CSS-pixel track width on screen vs view width on export). The per-row
// cross-hatches that used to ride beside these are the chrome's now, off
// `valueScales`.
export default observer(function MultiWiggleRowSeparators({
  model,
  width,
}: {
  model: SeparatorModel
  width: number
}) {
  const {
    isOverlay,
    isDensityMode,
    showRowSeparators,
    numRows,
    effectiveRowHeight,
  } = model
  // A subtle 1px hairline in the theme's divider color, shared with the
  // multi-row feature display (RowSeparatorLines, which owns the pixel rule).
  // Density rows are edge-to-edge fill, so the line is dialed up there to stay
  // visible over the saturated blocks; xyplot rows sit on paper, so it can be
  // fainter.
  return !isOverlay && showRowSeparators ? (
    <RowSeparatorLines
      numRows={numRows}
      rowHeight={effectiveRowHeight}
      width={width}
      opacity={isDensityMode ? 0.3 : 0.15}
    />
  ) : null
})
