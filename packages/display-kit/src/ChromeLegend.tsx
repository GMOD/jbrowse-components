import { FloatingLegend } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import type { LegendHost } from './legendHost.ts'

/**
 * The on-screen key of a display composing `LegendMixin`, drawn by the chrome
 * off `legendSpec` so no display places its own. Its own observer, so a
 * scale that re-derives on every fetch re-renders the box and not the chrome
 * around it.
 */
const ChromeLegend = observer(function ChromeLegend({
  model,
}: {
  model: LegendHost
}) {
  const { showLegend, legendSpec, legendTop } = model
  return showLegend ? (
    <FloatingLegend
      sections={legendSpec.sections}
      title={legendSpec.title}
      top={legendTop}
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
  ) : null
})

export default ChromeLegend
