import { Suspense } from 'react'
import type { ComponentType, ReactNode } from 'react'

import { getEnv } from '@jbrowse/core/util'
import { PluggableComponent } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import DotplotGrid from './DotplotGrid.tsx'

import type { DotplotInteraction } from './useDotplotInteraction.ts'
import type { DotplotViewModel } from '../model.ts'

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
  const {
    ctrlKeyDown,
    validSelect,
    mousedown,
    mouserect,
    xdistance,
    ydistance,
    setMouseDownClient,
    setMouseCurrClient,
    setCtrlKeyWasUsed,
  } = interaction
  const { pluginManager } = getEnv(model)
  const svgOverlays = pluginManager.evaluateExtensionPoint(
    'DotplotView-OverlaySVGComponent',
    [],
    { model },
  )
  return (
    <div
      style={{ cursor: ctrlKeyDown ? 'pointer' : model.cursorMode, position: 'relative' }}
      onMouseDown={event => {
        if (event.button === 0) {
          const { clientX, clientY } = event
          setMouseDownClient([clientX, clientY])
          setMouseCurrClient([clientX, clientY])
          setCtrlKeyWasUsed(ctrlKeyDown)
        }
      }}
    >
      <svg
        width={model.viewWidth}
        height={model.viewHeight}
        style={{ background: 'rgba(0,0,0,0.12)' }}
      >
        <DotplotGrid model={model}>
          {validSelect && mousedown && mouserect ? (
            <rect
              fill="rgba(255,0,0,0.3)"
              x={Math.min(mouserect[0], mousedown[0])}
              y={Math.min(mouserect[1], mousedown[1])}
              width={Math.abs(xdistance)}
              height={Math.abs(ydistance)}
            />
          ) : null}
          {svgOverlays}
        </DotplotGrid>
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <Suspense fallback={null}>
          <PluggableComponent
            pluginManager={pluginManager}
            name="DotplotView-OverlayHTMLComponent"
            component={NoHTMLOverlay}
            props={{ model }}
          />
        </Suspense>
      </div>
    </div>
  )
})

export default MouseInteractionLayer
