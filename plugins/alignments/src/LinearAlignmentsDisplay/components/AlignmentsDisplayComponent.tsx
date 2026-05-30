import { Suspense, useRef, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { Menu } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import LoadingOverlay from './LoadingOverlay.tsx'

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

    const {
      TooltipComponent,
      DisplayMessageComponent,
      height,
      contextMenuCoord,
    } = model
    const items = contextMenuCoord ? model.contextMenuItems() : []
    return (
      <div
        ref={ref}
        data-testid={`display-${getConf(model, 'displayId')}${model.canvasDrawn ? '-done' : ''}`}
        className={classes.display}
        onMouseMove={event => {
          if (!ref.current) {
            return
          }
          const { left, top } = ref.current.getBoundingClientRect()
          setMouseCoord({
            offset: [event.clientX - left, event.clientY - top],
            client: [event.clientX, event.clientY],
          })
        }}
      >
        <DisplayMessageComponent model={model} />
        <AlignmentsLoadingOverlay model={model} />
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
      </div>
    )
  },
)

const AlignmentsLoadingOverlay = observer(function AlignmentsLoadingOverlay({
  model,
}: {
  model: Pick<
    LinearAlignmentsDisplayModel,
    'isReady' | 'viewportCovered' | 'statusMessage' | 'regionTooLarge' | 'error'
  >
}) {
  // viewportCovered goes false when stale data (e.g. long-read coverage tailing
  // off past the originally fetched region) is on screen during the pre-refetch
  // debounce — show the scrim then too, so the overlay never claims provisional
  // data is final. regionTooLarge/error stay excluded (their own UI shows).
  return (
    <LoadingOverlay
      statusMessage={model.statusMessage ?? 'Loading features'}
      isVisible={
        (!model.isReady || !model.viewportCovered) &&
        !model.regionTooLarge &&
        !model.error
      }
    />
  )
})

export default AlignmentsDisplayComponent
