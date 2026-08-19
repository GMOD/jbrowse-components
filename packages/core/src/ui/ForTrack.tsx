import { observer } from 'mobx-react'

import { selectorMatchesModel } from './extensionSelectors.ts'

import type { TrackSelector } from './extensionSelectors.ts'
import type { ReactNode } from 'react'

/**
 * Render `children` only for the tracks `select` matches, and `fallback`
 * otherwise. Every field given must match; an empty selector matches
 * everything.
 *
 * This is how a contribution to any of the track-scoped extension points says
 * which tracks it is for. The points all fire for every track, so the
 * alternative is `props.model.trackId === 'x'` written by hand, which stops
 * applying the moment the user copies the track — {@link matchTrackId}
 * normalizes the copy's suffix here so nobody has to know that.
 *
 * In a panel point, where the accumulated array already composes, omit
 * `fallback` and the panel simply does not appear:
 *
 * ```tsx
 * const MyPanel = (props: FeaturePanelProps) => (
 *   <ForTrack {...props} select={{ trackType: 'VariantTrack' }}>
 *     <BaseCard title="Mine">…</BaseCard>
 *   </ForTrack>
 * )
 * ```
 *
 * In a slot point, where exactly one component renders, `fallback` is the
 * component you were handed — passing it is what keeps other plugins visible on
 * the tracks you did not select. See {@link wrapComponent}.
 */
const ForTrack = observer(function ForTrack({
  select,
  model,
  config,
  fallback = null,
  children,
}: {
  select: TrackSelector
  /** a widget model, if the point's props carry one */
  model?: { type?: string; trackId?: string; trackType?: string }
  /** a track config, if they carry that instead — its `type` is the track type */
  config?: { trackId?: string; type?: string }
  /** what to render when the selector does not match */
  fallback?: ReactNode
  children: ReactNode
}) {
  const subject = model ?? {
    trackId: config?.trackId,
    trackType: config?.type,
  }
  return <>{selectorMatchesModel(select, subject) ? children : fallback}</>
})

export default ForTrack
