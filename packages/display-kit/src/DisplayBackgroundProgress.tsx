// the deep subpath: the `@jbrowse/core/ui` barrel lands 40-odd Material modules
// in every display's chunk
import ProgressChip from '@jbrowse/core/ui/ProgressChip'
import { observer } from 'mobx-react'

import type { BackgroundProgressProps } from '@jbrowse/display-ui'

/**
 * The status channel for work that runs while the display is `ready`:
 * clustering, sorting, anything that reports through `setStatusMessage` without
 * a fetch behind it. A corner chip rather than the scrim, because the drawn
 * rows underneath stay usable.
 */
const DisplayBackgroundProgress = observer(function DisplayBackgroundProgress({
  message,
  progress,
}: BackgroundProgressProps) {
  return (
    <ProgressChip
      status={{ message, fraction: progress }}
      // the chrome anchors the corner it shares with the display's control row
      anchored={false}
    />
  )
})

export default DisplayBackgroundProgress
