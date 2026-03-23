import { Box, Chip, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { AwardDefinition } from '../../RLPipeline/types.ts'
import type { ScavengerHuntWidgetModel } from '../model.ts'

const AwardChips = observer(function AwardChips({
  model,
}: {
  model: ScavengerHuntWidgetModel
}) {
  if (model.earnedAwardIds.length === 0) {
    return null
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
      {model.earnedAwardIds.map(id => {
        const def = model.awardDefinitions.find(
          (a: AwardDefinition) => a.id === id,
        )
        return (
          <Tooltip
            key={id}
            title={def?.flavorText ?? def?.description ?? id}
          >
            <Chip
              label={def?.name ?? id}
              size="small"
              color="primary"
              variant="outlined"
              sx={{
                animation: 'awardPopIn 0.3s ease-out',
                '@keyframes awardPopIn': {
                  '0%': { transform: 'scale(0)', opacity: 0 },
                  '70%': { transform: 'scale(1.1)' },
                  '100%': { transform: 'scale(1)', opacity: 1 },
                },
              }}
            />
          </Tooltip>
        )
      })}
    </Box>
  )
})

export default AwardChips
