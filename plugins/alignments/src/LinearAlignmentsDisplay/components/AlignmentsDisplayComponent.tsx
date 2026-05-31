import { Suspense, useRef, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { LoadingOverlay, Menu } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import PileupBody from './PileupComponent.tsx'
import { AlignmentsRenderer } from '../renderers/AlignmentsRenderer.ts'

import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  display: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    minHeight: '100%',
  },
})

const AlignmentsDisplayComponent = observer(
  function AlignmentsDisplayComponent({
    model,
  }: {
    model: LinearAlignmentsDisplayModel
  }) {
    const { classes } = useStyles()
    const ref = useRef<HTMLDivElement>(null)
    const [mouseCoord, setMouseCoord] = useState<{
      offset: [number, number]
      client: [number, number]
    }>({ offset: [0, 0], client: [0, 0] })
    const view = getContainingView(model) as LinearGenomeViewModel

    if (!view.initialized) {
      return (
        <div className={classes.display}>
          <LoadingOverlay statusMessage="Initializing" isVisible />
        </div>
      )
    }

    const { TooltipComponent, height, contextMenuCoord } = model
    const items = contextMenuCoord ? model.contextMenuItems() : []
    return (
      <DisplayChrome
        model={model}
        factory={AlignmentsRenderer}
        ref={ref}
        data-testid={`display-${getConf(model, 'displayId')}${model.canvasDrawn ? '-done' : ''}`}
        className={classes.display}
        onMouseMove={event => {
          if (ref.current) {
            const { left, top } = ref.current.getBoundingClientRect()
            setMouseCoord({
              offset: [event.clientX - left, event.clientY - top],
              client: [event.clientX, event.clientY],
            })
          }
        }}
      >
        {({ canvasRef, canvas }) => (
          <>
            <PileupBody model={model} canvasRef={canvasRef} canvas={canvas} />
            <Suspense fallback={null}>
              <TooltipComponent
                model={model}
                height={height}
                offsetMouseCoord={mouseCoord.offset}
                clientMouseCoord={mouseCoord.client}
              />
            </Suspense>
            {contextMenuCoord && items.length > 0 ? (
              <Menu
                open
                onMenuItemClick={(_, callback) => {
                  callback()
                }}
                onClose={() => {
                  model.clearContextMenu()
                }}
                slotProps={{
                  transition: {
                    onExit: () => {
                      model.clearContextMenu()
                    },
                  },
                }}
                anchorReference="anchorPosition"
                anchorPosition={{
                  top: contextMenuCoord[1],
                  left: contextMenuCoord[0],
                }}
                menuItems={items}
              />
            ) : null}
          </>
        )}
      </DisplayChrome>
    )
  },
)

export default AlignmentsDisplayComponent
