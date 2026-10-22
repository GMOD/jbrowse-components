import { Suspense } from 'react'

import { observer } from 'mobx-react'

import LevelSyntenyCanvas from './LevelSyntenyCanvas.tsx'

import type { LinearSyntenyViewHelperModel } from './stateModelFactory.ts'
import type React from 'react'

/**
 * #api
 * One ribbon band between two rows of a synteny view: the shared ribbon canvas,
 * with each synteny display's own tooltip, context menu and fetch status over
 * it. `children` draw over the band too.
 *
 * The band takes its height from the level, not from what is drawn in it: the
 * canvas is absolutely positioned, and a level with no synteny track is legal.
 * The overlays come from `linearSyntenyDisplays`, the list the canvas uploads
 * geometry for, so a painted ribbon always has an overlay to hover.
 */
export const SyntenyLevel = observer(function SyntenyLevel({
  level,
  children,
}: {
  level: LinearSyntenyViewHelperModel
  children?: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative', height: level.height }}>
      <div style={{ display: 'grid' }}>
        <LevelSyntenyCanvas model={level} />
        {level.linearSyntenyDisplays.map(display => (
          <div
            key={display.id}
            style={{
              zIndex: 100,
              gridArea: '1/1',
              pointerEvents: 'none',
              height: display.height,
              overflow: 'hidden',
            }}
          >
            <Suspense fallback={null}>
              <display.RenderingComponent model={display} />
            </Suspense>
          </div>
        ))}
      </div>
      {children}
    </div>
  )
})
