import { Box, Card, CardContent, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { ScavengerHuntWidgetModel } from '../model.ts'

const CompletionScreen = observer(function CompletionScreen({
  model,
}: {
  model: ScavengerHuntWidgetModel
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" sx={{ mb: 2 }}>
          All tasks complete!
        </Typography>
        {model.completionCode ? (
          <>
            <Typography sx={{ mb: 1 }}>Your completion code:</Typography>
            <Box
              sx={{
                p: 2,
                bgcolor: 'grey.100',
                borderRadius: 1,
                textAlign: 'center',
                mb: 2,
              }}
            >
              <Typography
                variant="h4"
                sx={{ fontFamily: 'monospace', letterSpacing: 2 }}
              >
                {model.completionCode}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Copy this code back to the MTurk HIT page.
            </Typography>
          </>
        ) : (
          <Typography>Generating completion code...</Typography>
        )}
      </CardContent>
    </Card>
  )
})

export default CompletionScreen
