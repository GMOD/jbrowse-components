import ConnectedHoverHighlight from './ConnectedHoverHighlight.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseFeatureWidgetModel } from '@jbrowse/core/BaseFeatureWidget'

// A feature-detail widget is "connected" to this view when its `view` reference
// points back at it; that widget's sequence panel publishes the hovered base as
// `sequenceFeatureDetails.hoverPosition`.
function isFeatureWidgetForView(
  w: unknown,
  viewId: string,
): w is BaseFeatureWidgetModel {
  const candidate = w as Partial<BaseFeatureWidgetModel> | null
  return (
    !!candidate &&
    !!candidate.sequenceFeatureDetails &&
    candidate.view?.id === viewId
  )
}

// Draws a crosshair on the LGV at the base a connected feature-detail sequence
// panel is hovering, so mousing over the sequence readout points at the genome.
export default function SequenceFeatureHoverHighlight({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  return (
    <ConnectedHoverHighlight
      model={model}
      getPosition={(widget, viewId) =>
        isFeatureWidgetForView(widget, viewId)
          ? widget.sequenceFeatureDetails.hoverPosition
          : undefined
      }
    />
  )
}
