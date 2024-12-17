import { getContainingView, measureText } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import FullHeightScaleBar from './FullHeightScaleBar'
import IndividualScaleBars from './IndividualScaleBars'

import type { WiggleDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const Wrapper = observer(function ({
  children,
  model,
  exportSVG,
}: {
  model: WiggleDisplayModel
  children: React.ReactNode
  exportSVG?: boolean
}) {
  const { height } = model
  return exportSVG ? (
    children
  ) : (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        height,
        width: getContainingView(model).width,
      }}
    >
      {children}
    </svg>
  )
})

export const YScaleBars = observer(function (props: {
  model: WiggleDisplayModel
  orientation?: string
  exportSVG?: boolean
}) {
  const { model, orientation, exportSVG } = props
  const { stats, needsFullHeightScalebar, rowHeight, sources } = model
  const svgFontSize = Math.min(rowHeight, 12)
  const canDisplayLabel = rowHeight > 11
  const { width: viewWidth } = getContainingView(model) as LGV
  const minWidth = 20

  const ready = stats && sources
  if (!ready) {
    return null
  }

  const labelWidth = Math.max(
    ...sources
      .map(s => measureText(s.name, svgFontSize))
      .map(width => (canDisplayLabel ? width : minWidth)),
  )

  return (
    <Wrapper {...props}>
      {needsFullHeightScalebar ? (
        <FullHeightScaleBar
          model={model}
          orientation={orientation}
          exportSVG={exportSVG}
          viewWidth={viewWidth}
          labelWidth={labelWidth}
        />
      ) : (
        <IndividualScaleBars
          model={model}
          orientation={orientation}
          exportSVG={exportSVG}
          labelWidth={labelWidth}
        />
      )}
    </Wrapper>
  )
})

export default YScaleBars
