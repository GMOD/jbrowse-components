import { Suspense, useRef, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { Menu } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import LoadingOverlay from './LoadingOverlay.tsx'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

type Coord = [number, number]

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
    const [offsetMouseCoord, setOffsetMouseCoord] = useState<Coord>([0, 0])
    const [clientMouseCoord, setClientMouseCoord] = useState<Coord>([0, 0])
    const {
      TooltipComponent,
      DisplayMessageComponent,
      height,
      contextMenuCoord,
      showLoading,
      statusMessage,
    } = model
    const items = contextMenuCoord ? model.contextMenuItems() : []
    return (
      <div
        ref={ref}
        data-testid={`display-${getConf(model, 'displayId')}`}
        className={classes.display}
        onMouseMove={event => {
          if (!ref.current) {
            return
          }
          const rect = ref.current.getBoundingClientRect()
          const { left, top } = rect
          setOffsetMouseCoord([event.clientX - left, event.clientY - top])
          setClientMouseCoord([event.clientX, event.clientY])
        }}
      >
        <DisplayMessageComponent model={model} />
        <LoadingOverlay statusMessage={statusMessage} isVisible={showLoading} />
        <Suspense fallback={null}>
          <TooltipComponent
            model={model}
            height={height}
            offsetMouseCoord={offsetMouseCoord}
            clientMouseCoord={clientMouseCoord}
          />
        </Suspense>
        {contextMenuCoord && items.length > 0 ? (
          <Menu
            open
            onMenuItemClick={(_, callback) => {
              callback()
              model.setContextMenuCoord(undefined)
            }}
            onClose={() => {
              model.setContextMenuCoord(undefined)
              model.setContextMenuFeature(undefined)
              model.setContextMenuCigarHit(undefined)
              model.setContextMenuIndicatorHit(undefined)
            }}
            slotProps={{
              transition: {
                onExit: () => {
                  model.setContextMenuCoord(undefined)
                  model.setContextMenuFeature(undefined)
                  model.setContextMenuCigarHit(undefined)
                  model.setContextMenuIndicatorHit(undefined)
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
      </div>
    )
  },
)

export default AlignmentsDisplayComponent
