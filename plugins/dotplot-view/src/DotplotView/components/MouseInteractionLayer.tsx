import { Suspense } from 'react'

import { PluggableComponent } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import DotplotGrid from './DotplotGrid.tsx'

import type { DotplotViewModel } from '../model.ts'
import type { DotplotInteraction } from './useDotplotInteraction.ts'
import type { ComponentType, ReactNode } from 'react'

const useStyles = makeStyles()(theme => ({
  grid: {
    background: theme.palette.divider,
  },
  htmlOverlay: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
}))

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'DotplotView-OverlaySVGComponent': {
      args: ReactNode[]
      result: ReactNode[]
      props: { model: DotplotViewModel }
    }
    'DotplotView-OverlayHTMLComponent': {
      args: ComponentType<{ model: DotplotViewModel }>
      result: ComponentType<{ model: DotplotViewModel }>
      props: { model: DotplotViewModel }
    }
  }
}

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
      <svg
        width={model.viewWidth}
        height={model.viewHeight}
        className={classes.grid}
      >
        <DotplotGrid model={model}>
          {validSelect && anchor && pointer ? (
            <rect
              fill="rgba(255,0,0,0.3)"
              x={Math.min(anchor.x, pointer.x)}
              y={Math.min(anchor.y, pointer.y)}
              width={Math.abs(dx)}
              height={Math.abs(dy)}
            />
          ) : null}
          {svgOverlays}
        </DotplotGrid>
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
