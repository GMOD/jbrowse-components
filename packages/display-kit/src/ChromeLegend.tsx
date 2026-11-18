import {
  FLOATING_LEGEND_RIGHT_PX,
  FLOATING_LEGEND_TOP_PX,
  FloatingLegend,
} from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import { axisCaptionsReservedPx, isAxisHost } from './axisHost.ts'

import type { LegendHost } from './legendHost.ts'

const LegendBox = observer(function LegendBox({
  model,
  captionsReservedPx,
}: {
  model: LegendHost
  captionsReservedPx: number
}) {
  const { legendSpec, legendRight, legendTop, legendMaxWidth } = model
  return (
    <FloatingLegend
      sections={legendSpec.sections}
      title={legendSpec.title}
      top={FLOATING_LEGEND_TOP_PX + captionsReservedPx + (legendTop ?? 0)}
      pushedDown={legendTop}
      right={FLOATING_LEGEND_RIGHT_PX + (legendRight ?? 0)}
      maxWidth={legendMaxWidth}
      onDismiss={() => {
        model.setShowLegend(false)
      }}
      onDismissSection={id => {
        model.dismissLegendSection(id)
      }}
      onItemClick={
        model.focusLegendEntry
          ? (item, section) => {
              if (item.value !== undefined) {
                model.focusLegendEntry!(section.id, item.value)
              }
            }
          : undefined
      }
    />
  )
})

/**
 * The on-screen key of a display composing `LegendMixin`, drawn by the chrome
 * off `legendSpec` so no display places its own, below whatever `[min, max]`
 * captions the chrome's axes took at the corner. Its own observer, so a
 * scale that re-derives on every fetch re-renders the box and not the chrome
 * around it. Only this shell reads `axes`, which a mark display rebuilds on
 * every vertical-scroll frame, and it hands the box the one number it yields.
 */
const ChromeLegend = observer(function ChromeLegend({
  model,
}: {
  model: LegendHost
}) {
  return model.showLegend ? (
    <LegendBox
      model={model}
      captionsReservedPx={isAxisHost(model) ? axisCaptionsReservedPx(model) : 0}
    />
  ) : null
})

export default ChromeLegend
