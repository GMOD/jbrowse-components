// the deep subpath, never the `@jbrowse/core/ui` barrel: one named import from
// it lands 40-odd Material modules — FileSelector, FatalErrorDialog, the
// cascading-menu stack, PluginManager via addReplaceWidget — in whatever chunk
// reaches this file. `plainChromeOverlays.tsx` carries the same rule; this is
// the module where breaking it cost the most, because the overlay seam ran
// through here.
import ProgressChip from '@jbrowse/core/ui/ProgressChip'
import { observer } from 'mobx-react'

export interface DisplayBackgroundProgressModel {
  statusMessage?: string
  statusProgress?: number
}

/**
 * The status channel again, for work that runs while the display is `ready`:
 * clustering, sorting, anything that reports through `setStatusMessage` without
 * a fetch behind it. The loading scrim only covers the `loading` phase, so this
 * work used to run invisibly — a session-triggered cluster of a big cohort sat
 * on drawn-but-unclustered rows for many seconds with nothing on screen.
 *
 * A corner chip rather than the scrim because the content underneath is real and
 * still usable: the rows are drawn, they just aren't reordered yet. `visible` is
 * the phase gate (the chrome passes `phase === 'ready'`), so the scrim and the
 * chip can never both be up for the same message.
 */
const DisplayBackgroundProgress = observer(function DisplayBackgroundProgress({
  model,
  visible,
}: {
  model: DisplayBackgroundProgressModel
  visible: boolean
}) {
  return visible && model.statusMessage ? (
    <ProgressChip
      status={{ message: model.statusMessage, fraction: model.statusProgress }}
      // DisplayStatusChromeBase anchors the corner and shares it with the
      // display's control row; anchoring here too would put this underneath it
      anchored={false}
    />
  ) : null
})

export default DisplayBackgroundProgress
