import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import HoverPositionHighlight from './HoverPositionHighlight.tsx'

import type { LinearGenomeViewModel } from '../model.ts'
import type { HoverHighlightPosition } from './HoverPositionHighlight.tsx'

// Draws a crosshair for every session widget "connected" to this view that is
// currently publishing a hover position. Each cross-widget hover overlay (the
// feature-detail sequence panel, the MAF sequence widget) supplies only its own
// `getPosition`, which narrows an arbitrary widget to its model and returns the
// hovered interval or undefined; the widget iteration and drawing are shared.
const ConnectedHoverHighlight = observer(function ConnectedHoverHighlight({
  model,
  getPosition,
}: {
  model: LinearGenomeViewModel
  getPosition: (
    widget: unknown,
    viewId: string,
  ) => HoverHighlightPosition | undefined
}) {
  const session = getSession(model)
  const widgets =
    'widgets' in session ? (session.widgets as Map<string, unknown>) : undefined

  return !widgets ? null : (
    <>
      {[...widgets].flatMap(([id, widget]) => {
        const position = getPosition(widget, model.id)
        return position
          ? [
              <HoverPositionHighlight
                key={`hover-${id}`}
                model={model}
                position={position}
              />,
            ]
          : []
      })}
    </>
  )
})

export default ConnectedHoverHighlight
