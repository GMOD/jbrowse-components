import { observer } from 'mobx-react'

import ConnectedHoverHighlight from './ConnectedHoverHighlight.tsx'
import HoverPositionHighlight from './HoverPositionHighlight.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type {
  BaseFeatureWidgetModel,
  SequenceHoverPosition,
} from '@jbrowse/core/BaseFeatureWidget'

// A feature-detail widget is "connected" to this view when its `view` reference
// points back at it; that widget's sequence panel publishes the hovered base as
// `sequenceHoverPosition`.
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

// The same panel also opens straight off a feature's right-click menu, where it
// is owned by the display rather than by a widget — so the view's own displays
// publish hover positions too.
function displayHoverPosition(display: unknown) {
  const candidate = display as {
    sequenceHoverPosition?: SequenceHoverPosition
  } | null
  return candidate?.sequenceHoverPosition
}

// Draws a crosshair on the LGV at the base a connected feature-detail sequence
// panel is hovering, so mousing over the sequence readout points at the genome.
const SequenceFeatureHoverHighlight = observer(
  function SequenceFeatureHoverHighlight({
    model,
  }: {
    model: LinearGenomeViewModel
  }) {
    return (
      <>
        <ConnectedHoverHighlight
          model={model}
          getPosition={(widget, viewId) =>
            isFeatureWidgetForView(widget, viewId)
              ? widget.sequenceHoverPosition
              : undefined
          }
        />
        {model.tracks
          .flatMap(track => track.displays)
          .flatMap(display => {
            const position = displayHoverPosition(display)
            return position
              ? [
                  <HoverPositionHighlight
                    key={`hover-${display.id}`}
                    model={model}
                    position={position}
                  />,
                ]
              : []
          })}
      </>
    )
  },
)

export default SequenceFeatureHoverHighlight
