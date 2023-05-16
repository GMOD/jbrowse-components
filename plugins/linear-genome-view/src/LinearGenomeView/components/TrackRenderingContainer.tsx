import React, { useEffect, useRef } from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'

// jbrowse core
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getConf } from '@jbrowse/core/configuration'
import { useDebouncedCallback } from '@jbrowse/core/util'

// locals
import { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()({
  // aligns with block boundaries. check for example the breakpoint split view
  // demo to see if features align if wanting to change things
  renderingComponentContainer: {
    position: 'absolute',
    // -1 offset because of the 1px border of the Paper
    left: -1,
    height: '100%',
    width: '100%',
  },

  trackRenderingContainer: {
    overflowY: 'auto',
    overflowX: 'hidden',
    whiteSpace: 'nowrap',
    position: 'relative',
    background: 'none',
    zIndex: 2,
  },
})

type LGV = LinearGenomeViewModel

export default observer(function TrackRenderingContainer({
  model,
  track,
}: {
  model: LGV
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  const display = track.displays[0]
  const { draggingTrackId } = model
  const { height, RenderingComponent, DisplayBlurb } = display
  const trackId = getConf(track, 'trackId')
  const ref = useRef<HTMLDivElement>(null)
  const dimmed = draggingTrackId !== undefined && draggingTrackId !== display.id
  const minimized = track.minimized
  const debouncedOnDragEnter = useDebouncedCallback(() => {
    if (isAlive(display) && dimmed) {
      model.moveTrack(draggingTrackId, track.id)
    }
  }, 100)
  useEffect(() => {
    if (ref.current) {
      model.trackRefs[trackId] = ref.current
    }
    return () => {
      delete model.trackRefs[trackId]
    }
  }, [model.trackRefs, trackId])

  return (
    <div
      className={classes.trackRenderingContainer}
      style={{ height: minimized ? 20 : height }}
      onScroll={evt => display.setScrollTop(evt.currentTarget.scrollTop)}
      onDragEnter={debouncedOnDragEnter}
      data-testid={`trackRenderingContainer-${model.id}-${trackId}`}
    >
      {!minimized ? (
        <>
          <div
            ref={ref}
            className={classes.renderingComponentContainer}
            style={{ transform: `scaleX(${model.scaleFactor})` }}
          >
            <RenderingComponent
              model={display}
              onHorizontalScroll={model.horizontalScroll}
            />
          </div>

          {DisplayBlurb ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: display.height - 20,
              }}
            >
              <DisplayBlurb model={display} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
})
