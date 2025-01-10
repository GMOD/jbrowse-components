import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import FullHeightScaleBar from './FullHeightScaleBar'
import IndividualScaleBars from './IndividualScaleBars'

import type { WiggleDisplayModel } from '../model'

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
  const { stats, needsFullHeightScalebar, sources } = model
  return stats && sources ? (
    <Wrapper {...props}>
      {needsFullHeightScalebar ? (
        <FullHeightScaleBar
          model={model}
          orientation={orientation}
          exportSVG={exportSVG}
        />
      ) : (
        <IndividualScaleBars
          model={model}
          orientation={orientation}
          exportSVG={exportSVG}
        />
      )}
    </Wrapper>
  ) : null
})

export default YScaleBars
