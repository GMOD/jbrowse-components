import { useMemo } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import MultiSampleVariantTooltip from './MultiSampleVariantTooltip.tsx'

import type { MultiSampleVariantBaseModel } from '../MultiSampleVariantBaseModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()(theme => ({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    zIndex: 800,
  },
  horizontalLine: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: theme.palette.text.primary,
    pointerEvents: 'none',
  },
  verticalLine: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: theme.palette.text.primary,
    pointerEvents: 'none',
  },
}))

const MultiSampleVariantCrosshairs = observer(function MultiSampleVariantCrosshairs({
  mouseX,
  mouseY,
  model,
  offsetX,
  offsetY,
}: {
  mouseX: number
  mouseY: number
  model: MultiSampleVariantBaseModel
  offsetX: number
  offsetY: number
}) {
  const { classes } = useStyles()
  const { hoveredGenotype, height, sourceMap } = model
  const { width } = getContainingView(model) as LinearGenomeViewModel

  const tooltipSource = useMemo(() => {
    if (!hoveredGenotype) {
      return undefined
    }
    const source = sourceMap?.[hoveredGenotype.name]
    return source ? { ...source, ...hoveredGenotype } : undefined
  }, [hoveredGenotype, sourceMap])

  return (
    <div className={classes.container} style={{ width, height }}>
      <div
        className={classes.horizontalLine}
        style={{ transform: `translateY(${mouseY}px)`, width }}
      />
      <div
        className={classes.verticalLine}
        style={{ transform: `translateX(${mouseX}px)`, height }}
      />
      {tooltipSource ? (
        <MultiSampleVariantTooltip
          source={tooltipSource}
          x={offsetX + mouseX}
          y={offsetY + mouseY}
        />
      ) : null}
    </div>
  )
})

export default MultiSampleVariantCrosshairs
