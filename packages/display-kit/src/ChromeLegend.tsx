import { useMemo } from 'react'

import {
  FLOATING_LEGEND_RIGHT_PX,
  FLOATING_LEGEND_TOP_PX,
  FloatingLegend,
} from '@jbrowse/display-ui'
import { computed } from 'mobx'
import { observer } from 'mobx-react'

import { axisCaptionsReservedPx, isAxisHost } from './axisHost.ts'

import type { LegendHost } from './legendHost.ts'

/**
 * The on-screen key of a display composing `LegendMixin`, drawn by the chrome
 * off `legendSpec` so no display places its own, below whatever `[min, max]`
 * captions the chrome's axes took at the corner. Its own observer, so a
 * scale that re-derives on every fetch re-renders the box and not the chrome
 * around it. The caption clearance is read through a `computed`, because a
 * mark display rebuilds `axes` on every vertical-scroll frame and the number
 * it yields almost never changes.
 */
const ChromeLegend = observer(function ChromeLegend({
  model,
}: {
  model: LegendHost
}) {
  const captionsReserved = useMemo(
    () =>
      computed(() => (isAxisHost(model) ? axisCaptionsReservedPx(model) : 0)),
    [model],
  )
  if (!model.showLegend) {
    return null
  }
  const { legendSpec, legendRight, legendTop, legendMaxWidth } = model
  const captions = captionsReserved.get()
  return (
    <FloatingLegend
      sections={legendSpec.sections}
      title={legendSpec.title}
      top={FLOATING_LEGEND_TOP_PX + captions + (legendTop ?? 0)}
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

export default ChromeLegend
