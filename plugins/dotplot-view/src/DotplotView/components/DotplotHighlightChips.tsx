import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'

const useStyles = makeStyles()({
  // anchored at the start of each band (top of a vertical band, left of a
  // horizontal band). pointerEvents auto so the chip is clickable even though
  // the overlay layer itself is pointerEvents:none
  chip: {
    position: 'absolute',
    pointerEvents: 'auto',
  },
})

// Positions a chip (passed as children) at the anchor of each band a region
// produces: a vertical band when the region is on the horizontal axis, a
// horizontal band when it is on the vertical axis (both for self-vs-self).
// HTML sibling of the SVG bands — the SVG draws the translucent fill, this
// draws the interactive chip on top without needing foreignObject.
const DotplotHighlightChips = observer(function DotplotHighlightChips({
  model,
  region,
  children,
}: {
  model: DotplotViewModel
  region: {
    assemblyName?: string
    refName: string
    start: number
    end: number
  }
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const { hview, vview } = model
  const onH =
    region.assemblyName === undefined ||
    hview.assemblyNames.includes(region.assemblyName)
  const onV =
    region.assemblyName === undefined ||
    vview.assemblyNames.includes(region.assemblyName)
  const h = onH ? model.getHHighlightCoords(region) : undefined
  const v = onV ? model.getVHighlightCoords(region) : undefined
  return (
    <>
      {h ? (
        <div className={classes.chip} style={{ left: h.left, top: 0 }}>
          {children}
        </div>
      ) : null}
      {v ? (
        <div className={classes.chip} style={{ left: 0, top: v.top }}>
          {children}
        </div>
      ) : null}
    </>
  )
})

export default DotplotHighlightChips
