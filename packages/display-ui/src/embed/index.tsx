import { Fragment, Suspense } from 'react'

import { useStalled, useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { useResizeDrag } from '@jbrowse/core/util/useResizeDrag'
import { observer } from 'mobx-react'

import { TrackOverlaySlot } from '../trackOverlay/TrackOverlaySlot.tsx'

import type { PanZoomView } from '@jbrowse/core/util/usePanZoom'
import type {
  ViewLoading as ViewLoadingValue,
  ViewStatus as ViewStatusValue,
} from '@jbrowse/core/util/viewStatus'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type React from 'react'

export { Legend } from './legend.tsx'
export { LocationBox, useLocationBox } from './location.tsx'
export { EmbedProvider } from './provider.tsx'
export { Highlights, RegionSeams, Scalebar } from './regions.tsx'

export interface EmbedDisplay {
  height: number
  RenderingComponent: React.ComponentType<{
    model: EmbedDisplay
    onHorizontalScroll?: (distance: number) => void
  }>
}

export interface EmbedView extends PanZoomView, IStateTreeNode {
  status: ViewStatusValue
  tracks: { configuration: { trackId: string } }[]
  getTrack: (trackId: string) => { activeDisplay: EmbedDisplay } | undefined
  setWidth: (width: number) => void
}

export const Track = observer(function Track({
  view,
  trackId,
}: {
  view: EmbedView
  trackId: string
}) {
  const display = view.getTrack(trackId)?.activeDisplay
  if (!display) {
    return null
  }
  const { RenderingComponent } = display
  return (
    <TrackOverlaySlot zIndex={3} style={{ height: display.height }}>
      <div style={{ position: 'absolute', inset: 0, contain: 'strict' }}>
        <Suspense fallback={null}>
          <RenderingComponent
            model={display}
            onHorizontalScroll={view.horizontalScroll}
          />
        </Suspense>
      </div>
    </TrackOverlaySlot>
  )
})

export interface ResizableDisplay {
  setResizing: (resizing: boolean) => void
  resizeHeight: (distance: number) => unknown
}

export const ResizeHandle = observer(function ResizeHandle({
  view,
  trackId,
  style,
}: {
  view: {
    getTrack: (
      trackId: string,
    ) => { activeDisplay: ResizableDisplay } | undefined
  }
  trackId: string
  style?: React.CSSProperties
}) {
  const display = view.getTrack(trackId)?.activeDisplay
  const props = useResizeDrag({
    onDragStart: () => {
      display?.setResizing(true)
    },
    onDrag: distance => {
      display?.resizeHeight(distance)
    },
    onDragEnd: () => {
      display?.setResizing(false)
    },
  })
  return display ? (
    <div
      {...props}
      data-gesture-owner="true"
      aria-label={`Resize ${trackId}`}
      style={{
        height: 4,
        cursor: 'row-resize',
        touchAction: 'none',
        background: 'color-mix(in srgb, currentColor 20%, transparent)',
        ...style,
      }}
    />
  ) : null
})

export const TrackToggle = observer(function TrackToggle({
  view,
  trackId,
  style,
  children,
}: {
  view: {
    tracks: { configuration: { trackId: string } }[]
    launchToggleTrack: (trackId: string) => Promise<unknown>
  }
  trackId: string
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  return (
    <label style={style}>
      <input
        type="checkbox"
        checked={view.tracks.some(t => t.configuration.trackId === trackId)}
        onChange={() => {
          void view.launchToggleTrack(trackId)
        }}
      />
      {children}
    </label>
  )
})

function ViewLoading({ message, progress, source }: ViewLoadingValue) {
  const stalled = useStalled(`${message}|${progress}|${source}`)
  return (
    <>
      {message}
      {progress === undefined ? null : (
        <progress
          value={progress}
          max={1}
          style={{ display: 'block', width: 300, maxWidth: '100%' }}
        />
      )}
      {stalled && source ? (
        <div style={{ overflowWrap: 'anywhere' }}>
          still waiting on {source}
        </div>
      ) : null}
    </>
  )
}

export const ViewStatus = observer(function ViewStatus({
  view,
  style,
}: {
  view: { status: ViewStatusValue }
  style?: React.CSSProperties
}) {
  const { status } = view
  return status.type === 'ready' ? null : (
    <div
      role={status.type === 'error' ? 'alert' : 'status'}
      style={{
        padding: '10px 12px',
        fontSize: '0.85rem',
        opacity: 0.75,
        ...style,
      }}
    >
      {status.type === 'error' ? (
        `Could not load: ${status.error instanceof Error ? status.error.message : String(status.error)}`
      ) : status.type === 'loading' ? (
        <ViewLoading {...status} />
      ) : (
        'Nothing to show yet'
      )}
    </div>
  )
})

export const TrackStack = observer(function TrackStack({
  view,
  trackIds,
  renderTrack,
  style,
  children,
}: {
  view: EmbedView
  trackIds?: string[]
  renderTrack?: (trackId: string) => React.ReactNode
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  const ids = trackIds ?? view.tracks.map(t => t.configuration.trackId)
  return (
    <div
      ref={ref}
      {...containerProps}
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: 'grab',
        ...style,
      }}
    >
      {view.status.type === 'ready' ? (
        <>
          {children}
          {ids.map(id =>
            renderTrack ? (
              <Fragment key={id}>{renderTrack(id)}</Fragment>
            ) : (
              <Track key={id} view={view} trackId={id} />
            ),
          )}
        </>
      ) : (
        <ViewStatus view={view} />
      )}
    </div>
  )
})
