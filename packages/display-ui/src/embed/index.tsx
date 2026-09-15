import { Suspense } from 'react'

import { useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { observer } from 'mobx-react'

import { TrackOverlaySlot } from '../trackOverlay/TrackOverlaySlot.tsx'

import type { PanZoomView } from '@jbrowse/core/util/usePanZoom'
import type { ViewStatus as ViewStatusValue } from '@jbrowse/core/util/viewStatus'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type React from 'react'

export { LocationBox, useLocationBox } from './location.tsx'
export { RegionSeams, Scalebar } from './regions.tsx'

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
      {status.type === 'error'
        ? `Could not load: ${status.error instanceof Error ? status.error.message : String(status.error)}`
        : status.type === 'loading'
          ? status.message
          : 'Nothing to show yet'}
    </div>
  )
})

export const TrackStack = observer(function TrackStack({
  view,
  trackIds,
  style,
  children,
}: {
  view: EmbedView
  trackIds?: string[]
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
          {ids.map(id => (
            <Track key={id} view={view} trackId={id} />
          ))}
        </>
      ) : (
        <ViewStatus view={view} />
      )}
    </div>
  )
})
