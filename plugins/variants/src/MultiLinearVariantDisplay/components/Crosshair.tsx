import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { MultiLinearVariantDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  cursor: {
    pointerEvents: 'none',
    zIndex: 1000,
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
  model: MultiLinearVariantDisplayModel
}) {
  const { classes } = useStyles()
  const { height, scrollTop, rowHeight, sources } = model
  const { width } = getContainingView(model) as LinearGenomeViewModel
  const source = sources?.[Math.floor(mouseY / rowHeight)]
  const y = mouseY - scrollTop
  return source ? (
    <div style={{ position: 'relative' }}>
      <svg
        className={classes.cursor}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: scrollTop,
        }}
      >
        <line x1={0} x2={width} y1={y} y2={y} stroke="black" />
        <line x1={mouseX} x2={mouseX} y1={0} y2={height} stroke="black" />
      </svg>
      <BaseTooltip>
        {source.color ? (
          <div
            style={{
              width: 10,
              height: 10,
              backgroundColor: source.color,
            }}
          />
        ) : null}
        <SanitizedHTML
          html={Object.entries(source)
            .filter(
              ([key]) => key !== 'color' && key !== 'name' && key !== 'HP',
            )
            .map(([key, value]) => `${key}:${value}`)
            .join('<br/>')}
        />
      </BaseTooltip>
    </div>
  ) : null
})

export default Crosshair
