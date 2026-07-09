import { getSession } from '@jbrowse/core/util'
import { HoverPositionHighlight } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

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

const MafSequenceHoverHighlight = observer(function MafSequenceHoverHighlight({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const session = getSession(model)
  const widgets =
    'widgets' in session ? (session.widgets as Map<string, unknown>) : undefined

  return !widgets ? null : (
    <>
      {[...widgets.values()].flatMap(widget => {
        if (
          isConnectedMafSequenceWidget(widget, model.id) &&
          widget.hoverHighlight
        ) {
          return [
            <HoverPositionHighlight
              key={`maf-hover-${widget.id}`}
              model={model}
              position={widget.hoverHighlight}
            />,
          ]
        } else {
          return []
        }
      })}
    </>
  )
})

export default MafSequenceHoverHighlight
