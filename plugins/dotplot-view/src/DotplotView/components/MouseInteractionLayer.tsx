import { Suspense } from 'react'

import { PluggableElements } from '@jbrowse/core/ui'
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
  return (
    <>
      {/* grid then overlays, the same order the SVG export's plot group uses
          (which then draws the dots over both). The rubber-band rect goes last:
          it is the live drag, and a highlight band painted after it tinted the
          selection the user is still dragging out. */}
      <svg width={model.viewWidth} height={model.viewHeight}>
        <DotplotGrid model={model} />
        <PluggableElements
          pluginManager={pluginManager}
          name="DotplotView-OverlaySVGComponent"
          props={{ model }}
        />
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
          <PluggableElements
            pluginManager={pluginManager}
            name="DotplotView-OverlayHTMLComponent"
            props={{ model }}
          />
        </Suspense>
      </div>
    </>
  )
})

export default MouseInteractionLayer
