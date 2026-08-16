import MuiTrackControl from './MuiTrackControl.tsx'
import { useTrackControlOverride } from './trackControlContext.ts'

import type { TrackControlProps } from './types.ts'

/**
 * What every display renders for a bottom-right control: JBrowse's own Material
 * UI look, unless a `TrackControlProvider` above it says otherwise.
 *
 * The context lives in `trackControlContext.ts` rather than here, because this
 * module binds `MuiTrackControl` — an override channel sharing a module with
 * the default it overrides drags that default into every consumer's bundle.
 *
 * Like the overlay context this is *reach*, not *weight*: a display renders
 * `TrackControl`, so Material UI stays in that display's chunk — it just stops
 * rendering. A display that wants it out of the module graph entirely renders a
 * `TrackControlComponent` of its own directly.
 *
 * Not an `observer` — it reads no observables, it only picks an implementation
 * and forwards. Callers that read model state build their props in their own
 * observer, the way `DisplayChrome` leaves observation to the components around
 * it.
 */
export default function TrackControl(props: TrackControlProps) {
  const Control = useTrackControlOverride() ?? MuiTrackControl
  return <Control {...props} />
}
