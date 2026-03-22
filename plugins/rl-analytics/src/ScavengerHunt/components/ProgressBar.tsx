import { Box, LinearProgress, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { ScavengerHuntWidgetModel } from '../model.ts'

const ProgressBar = observer(function ProgressBar({
  model,
}: {
  model: ScavengerHuntWidgetModel
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2">Progress</Typography>
        <Typography variant="body2">
          {model.completedTaskIds.length} / {model.tasks.length}
        </Typography>
      </Box>
      <LinearProgress variant="determinate" value={model.progress * 100} />
    </Box>
  )
})

export default ProgressBar
