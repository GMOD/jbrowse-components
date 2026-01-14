import { observer } from 'mobx-react'

import FullHeightScaleBar from './FullHeightScaleBar.tsx'
import IndividualScaleBars from './IndividualScaleBars.tsx'
import YScaleBarsWrapper from './YScaleBarsWrapper.tsx'

import type { WiggleDisplayModel } from '../model.ts'

const YScaleBars = observer(function YScaleBars(props: {
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
