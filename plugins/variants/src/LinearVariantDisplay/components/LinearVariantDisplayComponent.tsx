import {
  BaseLinearDisplayComponent,
  FloatingLegend,
} from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import type { LinearVariantDisplayModel } from '../model.ts'

// Reuses the canvas base display renderer and drops a floating color key into
// its (position:relative) container while "Color by consequence impact" is on.
const LinearVariantDisplayComponent = observer(
  function LinearVariantDisplayComponent({
    model,
  }: {
    model: LinearVariantDisplayModel
  }) {
    return (
      <BaseLinearDisplayComponent model={model}>
        {model.showImpactLegend ? (
          <FloatingLegend
            items={model.impactLegendItems}
            onDismiss={() => {
              model.setImpactLegendDismissed(true)
            }}
          />
        ) : null}
      </BaseLinearDisplayComponent>
    )
  },
)

export default LinearVariantDisplayComponent
