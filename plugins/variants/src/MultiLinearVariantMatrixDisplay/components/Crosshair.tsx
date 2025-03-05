import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import MultiVariantTooltip from '../../shared/components/MultiVariantTooltip'

import type { MultiLinearVariantMatrixDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  cursor: {
    pointerEvents: 'none',
    zIndex: 800,
    position: 'relative',
  },
})

const Crosshair = observer(function ({
  mouseX,
  mouseY,
  model,
}: {
  mouseX: number
  mouseY: number
  model: MultiLinearVariantMatrixDisplayModel
}) {
  const { classes } = useStyles()
  const { hoveredGenotype, lineZoneHeight, totalHeight, rowHeight, sources } =
    model
  const { width } = getContainingView(model) as LinearGenomeViewModel
  const source = sources?.[Math.floor((mouseY - lineZoneHeight) / rowHeight)]
  const yoff = mouseY - lineZoneHeight
  return source ? (
    <>
      <svg
        className={classes.cursor}
        width={width}
        height={totalHeight}
        style={{
          top: lineZoneHeight,
        }}
      >
        <line x1={0} x2={width} y1={yoff} y2={yoff} stroke="black" />
        <line x1={mouseX} x2={mouseX} y1={0} y2={totalHeight} stroke="black" />
      </svg>
      <MultiVariantTooltip source={{ ...source, hoveredGenotype }} />
    </>
  ) : null
})

export default Crosshair
