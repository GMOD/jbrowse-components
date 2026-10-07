import { Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

// Label column of the settings grid. The explanation lives in a tooltip rather
// than a caption under the control, so every row is one line tall and the
// controls line up with their labels.
const SettingLabel = observer(function SettingLabel({
  label,
  help,
}: {
  label: string
  help: string
}) {
  return (
    <Tooltip title={help} placement="left">
      <Typography variant="body2">{label}</Typography>
    </Tooltip>
  )
})

export default SettingLabel
