import { Suspense, useEffect, useRef, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import VirtualScrollbar from './VirtualScrollbar'

import type { LinearGenomeViewModel } from '..'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()({
  // aligns with block boundaries. check for example the breakpoint split view
  // demo to see if features align if wanting to change things
  renderingComponentContainer: {
    position: 'absolute',
    // -1 offset because of the 1px border of the Paper
    left: -1,
    height: '100%',
    width: '100%',
    willChange: 'transform',
  },

  trackRenderingContainer: {
    whiteSpace: 'nowrap',
    position: 'relative',
    background: 'none',
    contain: 'strict',
  },
  // When virtual scrollbars are enabled, hide overflow completely
  virtualScrollMode: {
    overflow: 'hidden',
  },
  // When virtual scrollbars are disabled, allow native scrolling
  nativeScrollMode: {
    overflowY: 'auto',
    overflowX: 'hidden',
  },
})

type LGV = LinearGenomeViewModel

const TrackRenderingContainer = observer(function ({
  model,
  track,
  onDragEnter,
}: {
  model: LGV
  track: BaseTrackModel
  onDragEnter: () => void
}) {
  const { classes } = useStyles()
  const display = track.displays[0]
  const { height, RenderingComponent, DisplayBlurb, scrollTop, blockState } =
    display
  const { trackRefs, id, scaleFactor } = model
  const session = getSession(model)
  const trackId = getConf(track, 'trackId')
  const ref = useRef<HTMLDivElement>(null)
  const minimized = track.minimized

  // Check if virtual scrollbars are enabled in user preferences
  const useVirtualScrollbars =
    'useVirtualScrollbars' in session ? session.useVirtualScrollbars : false

  // Calculate content height based on actual layout
  const containerHeight = minimized ? 20 : height
  let contentHeight = containerHeight

  // Get the maximum height from all block layouts
  if (blockState && !minimized) {
    let maxLayoutHeight = 0
    for (const block of blockState.values()) {
      if (block?.layout?.getTotalHeight) {
        maxLayoutHeight = Math.max(
          maxLayoutHeight,
          block.layout.getTotalHeight(),
        )
      }
    }
    // Use the larger of container height or actual content height
    contentHeight = Math.max(containerHeight, maxLayoutHeight)
  }

  useEffect(() => {
    if (ref.current) {
      trackRefs[trackId] = ref.current
    }
    return () => {
      delete trackRefs[trackId]
    }
  }, [trackRefs, trackId])

  const trackContent = (
    <div
      onDragEnter={onDragEnter}
      data-testid={`trackRenderingContainer-${id}-${trackId}`}
      style={{
        height: useVirtualScrollbars ? contentHeight : containerHeight,
        position: 'relative',
      }}
    >
      {!minimized ? (
        <>
          <div
            ref={ref}
            className={classes.renderingComponentContainer}
            style={{
              transform:
                scaleFactor !== 1 ? `scaleX(${scaleFactor})` : undefined,
            }}
          >
            <Suspense fallback={<LoadingEllipses />}>
              <RenderingComponent
                model={display}
                onHorizontalScroll={model.horizontalScroll}
              />
            </Suspense>
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

  if (useVirtualScrollbars) {
    // Use virtual scrollbar mode
    return (
      <VirtualScrollbar
        contentHeight={contentHeight}
        containerHeight={containerHeight}
        scrollTop={scrollTop}
        onScroll={newScrollTop => display.setScrollTop(newScrollTop)}
        className={`${classes.trackRenderingContainer} ${classes.virtualScrollMode}`}
      >
        {trackContent}
      </VirtualScrollbar>
    )
  } else {
    // Use native scrolling mode
    return (
      <div
        className={`${classes.trackRenderingContainer} ${classes.nativeScrollMode}`}
        style={{
          height: containerHeight,
        }}
        onScroll={evt => display.setScrollTop(evt.currentTarget.scrollTop)}
        onDragEnter={onDragEnter}
        data-testid={`trackRenderingContainer-${id}-${trackId}`}
      >
        {trackContent}
      </div>
    )
  }
})

export default TrackRenderingContainer
