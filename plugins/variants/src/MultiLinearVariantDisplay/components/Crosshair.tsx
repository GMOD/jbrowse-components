import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import MultiVariantTooltip from '../../shared/components/MultiVariantTooltip'

import type { MultiLinearVariantDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  rel: {
    position: 'relative',
  },
  cursor: {
    pointerEvents: 'none',
    zIndex: 800,
    position: 'absolute',
  },
  color: {
    width: 10,
    height: 10,
  },
})

const Crosshair = observer(function ({
  mouseX,
  mouseY,
  model,
}: {
  mouseX: number
  mouseY: number
  model: MultiLinearVariantDisplayModel
}) {
  const { classes } = useStyles()
  const { hoveredGenotype, height, scrollTop, rowHeight, sources } = model
  const { width } = getContainingView(model) as LinearGenomeViewModel
  const source = sources?.[Math.floor(mouseY / rowHeight)]
  const y = mouseY - scrollTop
  return source ? (
    <div className={classes.rel}>
      <svg
        className={classes.cursor}
        width={width}
        height={height}
        style={{
          top: scrollTop,
        }}
      >
        <line x1={0} x2={width} y1={y} y2={y} stroke="black" />
        <line x1={mouseX} x2={mouseX} y1={0} y2={height} stroke="black" />
      </svg>

      <MultiVariantTooltip source={{ ...source, hoveredGenotype }} />
    </div>
  ) : null
})

export default Crosshair
