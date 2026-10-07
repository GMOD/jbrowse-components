import { useTrackControlOverride } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import MuiTrackControl from './MuiTrackControl.tsx'

import type { TrackControlProps } from '@jbrowse/display-ui'

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
 */
const TrackControl = observer(function TrackControl(props: TrackControlProps) {
  const Control = useTrackControlOverride() ?? MuiTrackControl
  return <Control {...props} />
})

export default TrackControl
