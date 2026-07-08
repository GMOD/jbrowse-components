import { Suspense, useRef, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { LoadingOverlay, Menu } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { Link } from '@mui/material'
import { observer } from 'mobx-react'

import PileupBody from './PileupComponent.tsx'
import { AlignmentsRenderer } from '../renderers/AlignmentsRenderer.ts'

import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()(theme => ({
  display: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    minHeight: '100%',
  },
  maxHeight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 4px',
    fontSize: 11,
    color: theme.palette.text.secondary,
    background: theme.palette.background.paper,
    opacity: 0.9,
  },
}))

// maxHeight is in pixels; this is far above the Uint16 row ceiling so the
// `maxRows` getter clamps to the real limit and every stacked read shows.
const SHOW_ALL_MAX_HEIGHT = 1_000_000

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
    // Hiding a track detaches this display from the MST tree, which fires MobX
    // reactions synchronously inside the click handler — this still-mounted
    // observer re-renders once (reading config-backed getters like
    // `pileupTruncated`) before React unmounts it. Bail out while detached.
    if (!isAlive(model)) {
      return null
    }
    const view = getContainingView(model) as LinearGenomeViewModel

    if (!view.initialized) {
      return (
        <div className={classes.display}>
          <LoadingOverlay statusMessage="Initializing" isVisible immediate />
        </div>
      )
    }

    const { TooltipComponent, contextMenuCoord, pileupTruncated } = model
    const items = contextMenuCoord ? model.contextMenuItems() : []
    return (
      <DisplayChrome
        model={model}
        factory={AlignmentsRenderer}
        ref={ref}
        testid={`display-${getConf(model, 'displayId')}`}
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
            {pileupTruncated ? (
              <div className={classes.maxHeight}>
                <span>Max layout height reached</span>
                <Link
                  component="button"
                  variant="caption"
                  underline="hover"
                  onClick={() => {
                    model.setMaxHeight(SHOW_ALL_MAX_HEIGHT)
                  }}
                >
                  Show all alignments
                </Link>
              </div>
            ) : null}
            <Suspense fallback={null}>
              <TooltipComponent
                model={model}
                offsetMouseCoord={mouseCoord.offset}
                clientMouseCoord={mouseCoord.client}
              />
            </Suspense>
            {contextMenuCoord && items.length > 0 ? (
              <Menu
                open
                onMenuItemClick={callback => {
                  callback()
                }}
                onClose={() => {
                  model.closeContextMenu()
                }}
                slotProps={{
                  transition: {
                    onExit: () => {
                      model.closeContextMenu()
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
