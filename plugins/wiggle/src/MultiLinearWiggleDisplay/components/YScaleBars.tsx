import { observer } from 'mobx-react'

import FullHeightScaleBar from './FullHeightScaleBar'
import IndividualScaleBars from './IndividualScaleBars'
import YScaleBarsWrapper from './YScaleBarsWrapper'

import type { WiggleDisplayModel } from '../model'

const YScaleBars = observer(function (props: {
  model: WiggleDisplayModel
  orientation?: string
  exportSVG?: boolean
}) {
  const { model, orientation, exportSVG } = props
  const { showSidebar, stats, needsFullHeightScalebar, sources } = model
  return stats && sources ? (
    <YScaleBarsWrapper {...props}>
      {showSidebar ? (
        needsFullHeightScalebar ? (
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
        )
      ) : null}
    </YScaleBarsWrapper>
  ) : null
})

export default YScaleBars
