import { Alert, Box, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { AwardDefinition } from '../../RLPipeline/types.ts'
import type { ScavengerHuntWidgetModel } from '../model.ts'

const TierGate = observer(function TierGate({
  model,
}: {
  model: ScavengerHuntWidgetModel
}) {
  const missing = model.missingAwards
  if (missing.length === 0) {
    return null
  }

  const task = model.currentTask
  const coaching = task?.coaching

  return (
    <Box sx={{ mb: 2 }}>
      <Alert severity="info">
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Before continuing:
        </Typography>
        {missing.map(id => {
          const def = model.awardDefinitions.find(
            (a: AwardDefinition) => a.id === id,
          )
          return (
            <Typography key={id} variant="body2" sx={{ ml: 1 }}>
              {def ? `Earn "${def.name}" — ${def.description}` : `Earn award: ${id}`}
            </Typography>
          )
        })}
        {coaching && (
          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
            {coaching.message}
          </Typography>
        )}
      </Alert>
    </Box>
  )
})

export default TierGate
