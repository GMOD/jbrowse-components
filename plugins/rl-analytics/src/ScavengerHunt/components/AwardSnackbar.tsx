import { Alert, Snackbar, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { ScavengerHuntWidgetModel } from '../model.ts'

const AwardSnackbar = observer(function AwardSnackbar({
  model,
}: {
  model: ScavengerHuntWidgetModel
}) {
  const award = model.latestAward
  if (!award) {
    return null
  }

  return (
    <Snackbar
      open={!!award}
      autoHideDuration={4000}
      onClose={() => {
        model.clearLatestAward()
      }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Alert
        severity="success"
        variant="filled"
        sx={{
          bgcolor: 'success.dark',
          animation: 'awardSlideIn 0.4s ease-out',
          '@keyframes awardSlideIn': {
            '0%': { transform: 'translateY(20px)', opacity: 0 },
            '100%': { transform: 'translateY(0)', opacity: 1 },
          },
        }}
        onClose={() => {
          model.clearLatestAward()
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
          {award.name}
        </Typography>
        <Typography variant="caption">
          {award.flavorText ?? award.description}
        </Typography>
      </Alert>
    </Snackbar>
  )
})

export default AwardSnackbar
