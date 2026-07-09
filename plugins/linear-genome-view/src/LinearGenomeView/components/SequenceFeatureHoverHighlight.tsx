import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import HoverPositionHighlight from './HoverPositionHighlight.tsx'

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
const SequenceFeatureHoverHighlight = observer(
  function SequenceFeatureHoverHighlight({
    model,
  }: {
    model: LinearGenomeViewModel
  }) {
    const session = getSession(model)
    const widgets =
      'widgets' in session
        ? (session.widgets as Map<string, unknown>)
        : undefined

    return !widgets ? null : (
      <>
        {[...widgets.values()].flatMap(widget => {
          if (isFeatureWidgetForView(widget, model.id)) {
            const pos = widget.sequenceFeatureDetails.hoverPosition
            return pos
              ? [
                  <HoverPositionHighlight
                    key={`feature-sequence-hover-${widget.id}`}
                    model={model}
                    position={pos}
                  />,
                ]
              : []
          } else {
            return []
          }
        })}
      </>
    )
  },
)

export default SequenceFeatureHoverHighlight
