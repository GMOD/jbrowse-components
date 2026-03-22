import { Alert, Button, Card, CardContent, CardHeader, Chip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { TaskConfig } from '../../RLPipeline/types.ts'

const TaskCard = observer(function TaskCard({
  task,
  hintsRevealed,
  onRevealHint,
}: {
  task: TaskConfig
  hintsRevealed: number
  onRevealHint: () => void
}) {
  return (
    <Card sx={{ mb: 2 }}>
      <CardHeader
        title={
          <>
            <Chip
              label={`Tier ${task.tier}`}
              size="small"
              color={task.tier === 1 ? 'success' : task.tier === 2 ? 'warning' : 'error'}
              sx={{ mr: 1 }}
            />
            <Typography variant="h6" component="span">
              {task.title}
            </Typography>
          </>
        }
      />
      <CardContent>
        <Typography sx={{ mb: 2 }}>{task.description}</Typography>
        {Array.from({ length: hintsRevealed }, (_, i) => (
          <Alert key={i} severity="info" sx={{ mb: 1 }}>
            Hint {i + 1}: {task.hints[i]}
          </Alert>
        ))}
        {hintsRevealed < task.hints.length && (
          <Button variant="outlined" size="small" onClick={onRevealHint}>
            Reveal Hint ({task.hints.length - hintsRevealed} remaining)
          </Button>
        )}
      </CardContent>
    </Card>
  )
})

export default TaskCard
