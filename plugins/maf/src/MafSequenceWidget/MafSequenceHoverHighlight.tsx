import { ConnectedHoverHighlight } from '@jbrowse/plugin-linear-genome-view'

import type { MafSequenceWidgetModel } from './stateModelFactory.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function isConnectedMafSequenceWidget(
  w: unknown,
  viewId: string,
): w is MafSequenceWidgetModel {
  const candidate = w as Partial<MafSequenceWidgetModel> | null
  return (
    !!candidate &&
    candidate.type === 'MafSequenceWidget' &&
    candidate.connectedViewId === viewId
  )
}

export default function MafSequenceHoverHighlight({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  return (
    <ConnectedHoverHighlight
      model={model}
      getPosition={(widget, viewId) =>
        isConnectedMafSequenceWidget(widget, viewId)
          ? widget.hoverHighlight
          : undefined
      }
    />
  )
}
