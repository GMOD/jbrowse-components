import { Suspense, useEffect, useRef, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { LoadingEllipses } from '@jbrowse/core/ui'
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
  },

  trackRenderingContainer: {
    overflowX: 'hidden',
    whiteSpace: 'nowrap',
    position: 'relative',
    background: 'none',
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
  const { height, RenderingComponent, DisplayBlurb, scrollTop, blockState } = display
  const { trackRefs, id, scaleFactor } = model
  const trackId = getConf(track, 'trackId')
  const ref = useRef<HTMLDivElement>(null)
  const minimized = track.minimized

  // Calculate content height based on actual layout
  const containerHeight = minimized ? 20 : height
  let contentHeight = containerHeight

  // Get the maximum height from all block layouts
  if (blockState && !minimized) {
    let maxLayoutHeight = 0
    for (const block of blockState.values()) {
      if (block?.layout?.getTotalHeight) {
        maxLayoutHeight = Math.max(maxLayoutHeight, block.layout.getTotalHeight())
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

  return (
    <VirtualScrollbar
      contentHeight={contentHeight}
      containerHeight={containerHeight}
      scrollTop={scrollTop}
      onScroll={(newScrollTop) => display.setScrollTop(newScrollTop)}
      className={classes.trackRenderingContainer}
    >
      <div
        onDragEnter={onDragEnter}
        data-testid={`trackRenderingContainer-${id}-${trackId}`}
        style={{
          height: contentHeight, // Make content div use full content height
          position: 'relative'
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

            {/* Show test area only if content is larger than container */}
            {contentHeight > containerHeight && (
              <div style={{
                position: 'absolute',
                top: containerHeight,
                left: 0,
                height: contentHeight - containerHeight,
                width: '100%',
                backgroundColor: 'rgba(255, 0, 0, 0.05)',
                border: '1px dashed rgba(255, 0, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: 'rgba(255, 0, 0, 0.6)'
              }}>
                Extended content area (layout height: {contentHeight}px)
              </div>
            )}

            {/* Scroll position indicator */}
            <div style={{
              position: 'absolute',
              top: 10,
              right: 20,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'monospace',
              zIndex: 1001
            }}>
              Scroll: {scrollTop}/{contentHeight - containerHeight}
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
    </VirtualScrollbar>
  )
})

export default TrackRenderingContainer
