import { lazy } from 'react'

import { getDialogHost, pluralize } from '@jbrowse/core/util'
import ReportProblemIcon from '@mui/icons-material/ReportProblemOutlined'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { WarningsHost } from './TrackWarningsDialog.tsx'
import type { ReactNode } from 'react'

const TrackWarningsDialog = lazy(() => import('./TrackWarningsDialog.tsx'))

/**
 * The header affordance both comparative views show while any track has
 * render warnings: an icon at the far end of the bar, and the grouped report
 * behind it. `noun` names the view in the tooltip ("3 dotplot warnings"),
 * `title` and `children` are the dialog's heading and preamble.
 */
const TrackWarningsButton = observer(function TrackWarningsButton({
  model,
  noun,
  title,
  className,
  children,
}: {
  model: WarningsHost
  noun: string
  title: string
  className?: string
  children?: ReactNode
}) {
  const count = model.trackWarnings.reduce((n, t) => n + t.warnings.length, 0)
  return count ? (
    <Tooltip
      title={`${count} ${noun} ${pluralize(count, 'warning')} — click for details`}
    >
      <IconButton
        color="warning"
        className={className}
        onClick={() => {
          getDialogHost(model).queueDialog(handleClose => [
            TrackWarningsDialog,
            { model, title, children, handleClose },
          ])
        }}
      >
        <ReportProblemIcon />
      </IconButton>
    </Tooltip>
  ) : null
})

export default TrackWarningsButton
