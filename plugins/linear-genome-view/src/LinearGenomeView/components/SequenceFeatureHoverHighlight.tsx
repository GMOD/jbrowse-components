import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material'
import { observer } from 'mobx-react'

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

const useStyles = makeStyles()(theme => ({
  highlight: {
    height: '100%',
    position: 'absolute',
    background: alpha(theme.palette.primary.main, 0.4),
    borderLeft: `2px solid ${theme.palette.primary.main}`,
    borderRight: `2px solid ${theme.palette.primary.main}`,
    pointerEvents: 'none',
    zIndex: 10,
  },
}))

// Draws a crosshair on the LGV at the base a connected feature-detail sequence
// panel is hovering, so mousing over the sequence readout points at the genome.
const SequenceFeatureHoverHighlight = observer(
  function SequenceFeatureHoverHighlight({
    model,
  }: {
    model: LinearGenomeViewModel
  }) {
    const { classes } = useStyles()
    const session = getSession(model)
    const { assemblyManager } = session
    const widgets =
      'widgets' in session
        ? (session.widgets as Map<string, unknown>)
        : undefined

    return !widgets ? null : (
      <>
        {[...widgets.values()].flatMap(widget => {
          const nodes: React.ReactNode[] = []
          if (isFeatureWidgetForView(widget, model.id)) {
            const pos = widget.sequenceFeatureDetails.hoverPosition
            if (pos) {
              const { refName, start, end, assemblyName } = pos
              const canonicalRefName =
                assemblyManager
                  .get(assemblyName ?? '')
                  ?.getCanonicalRefName(refName) ?? refName
              const startPx = model.bpToPx({
                refName: canonicalRefName,
                coord: start,
              })
              const endPx = model.bpToPx({
                refName: canonicalRefName,
                coord: end,
              })
              if (startPx && endPx) {
                nodes.push(
                  <div
                    key={`feature-sequence-hover-${widget.id}`}
                    className={classes.highlight}
                    style={{
                      left:
                        Math.min(startPx.offsetPx, endPx.offsetPx) -
                        model.offsetPx,
                      width: Math.max(
                        Math.abs(endPx.offsetPx - startPx.offsetPx),
                        3,
                      ),
                    }}
                  />,
                )
              }
            }
          }
          return nodes
        })}
      </>
    )
  },
)

export default SequenceFeatureHoverHighlight
