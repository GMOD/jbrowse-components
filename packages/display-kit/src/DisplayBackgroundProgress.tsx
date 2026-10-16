// the deep subpath: the `@jbrowse/core/ui` barrel lands 40-odd Material modules
// in every display's chunk
import ProgressChip from '@jbrowse/core/ui/ProgressChip'
import { observer } from 'mobx-react'

import type { DisplayBackgroundProgressModel } from '@jbrowse/display-ui'

/**
 * The status channel for work that runs while the display is `ready`:
 * clustering, sorting, anything that reports through `setStatusMessage` without
 * a fetch behind it. A corner chip rather than the scrim, because the drawn
 * rows underneath stay usable. `visible` is `phase === 'ready'`, so the scrim
 * and the chip never show the same message together.
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
      // the chrome anchors the corner it shares with the display's control row
      anchored={false}
    />
  ) : null
})

export default DisplayBackgroundProgress
