import { Suspense } from 'react'

import { PluggableComponent } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import DotplotGrid from './DotplotGrid.tsx'

import type { DotplotViewModel } from '../model.ts'
import type { DotplotInteraction } from './useDotplotInteraction.ts'

const useStyles = makeStyles()({
  htmlOverlay: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
})

function NoHTMLOverlay(_props: { model: DotplotViewModel }) {
  return null
}

const MouseInteractionLayer = observer(function MouseInteractionLayer({
  model,
  interaction,
}: {
  model: DotplotViewModel
  interaction: DotplotInteraction
}) {
  const { validSelect, anchor, pointer, dx, dy } = interaction
  const { classes } = useStyles()
  const { pluginManager } = getEnv(model)
  const svgOverlays = pluginManager.evaluateExtensionPoint(
    /** #extensionPoint DotplotView-OverlaySVGComponent | sync | Add an SVG overlay component to the dotplot view */
    'DotplotView-OverlaySVGComponent',
    [],
    { model },
  )
  return (
    <>
      {/* grid then overlays, the same order the SVG export's plot group uses
          (which then draws the dots over both). The rubber-band rect goes last:
          it is the live drag, and a highlight band painted after it tinted the
          selection the user is still dragging out. */}
      <svg width={model.viewWidth} height={model.viewHeight}>
        <DotplotGrid model={model} />
        {svgOverlays}
        {validSelect && anchor && pointer ? (
          <rect
            fill="rgba(255,0,0,0.3)"
            x={Math.min(anchor.x, pointer.x)}
            y={Math.min(anchor.y, pointer.y)}
            width={Math.abs(dx)}
            height={Math.abs(dy)}
          />
        ) : null}
      </svg>
      <div className={classes.htmlOverlay}>
        <Suspense fallback={null}>
          <PluggableComponent
            pluginManager={pluginManager}
            name="DotplotView-OverlayHTMLComponent"
            component={NoHTMLOverlay}
            props={{ model }}
          />
        </Suspense>
      </div>
    </>
  )
})

export default MouseInteractionLayer
