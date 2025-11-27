import { useMemo, useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import MultiVariantTooltip from './MultiVariantTooltip'

import type { MultiVariantBaseModel } from '../MultiVariantBaseModel'
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
})

const MultiVariantCrosshairs = observer(function ({
  mouseX,
  mouseY,
  model,
}: {
  mouseX: number
  mouseY: number
  model: MultiVariantBaseModel
}) {
  const { classes } = useStyles()
  const theme = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const { hoveredGenotype, height, sourceMap } = model
  const { width } = getContainingView(model) as LinearGenomeViewModel

  const source = useMemo(
    () => (hoveredGenotype ? sourceMap?.[hoveredGenotype.name] : undefined),
    [hoveredGenotype, sourceMap],
  )

  const rect = ref.current?.getBoundingClientRect()
  const absX = (rect?.left ?? 0) + mouseX
  const absY = (rect?.top ?? 0) + mouseY

  return (
    <div ref={ref} className={classes.rel}>
      <svg
        className={classes.cursor}
        width={width}
        height={height}
        style={{
          top: 0,
        }}
      >
        <line
          x1={0}
          x2={width}
          y1={mouseY}
          y2={mouseY}
          stroke={theme.palette.text.primary}
        />
        <line
          x1={mouseX}
          x2={mouseX}
          y1={0}
          y2={height}
          stroke={theme.palette.text.primary}
        />
      </svg>

      {source ? (
        <MultiVariantTooltip
          source={{
            ...source,
            ...hoveredGenotype,
          }}
          x={absX}
          y={absY}
        />
      ) : null}
    </div>
  )
})

export default MultiVariantCrosshairs
