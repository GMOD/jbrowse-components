import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { useState } from 'react'

import type { TaskConfig } from '../../RLPipeline/types.ts'

const AnswerInput = observer(function AnswerInput({
  task,
  currentAnswer,
  onSubmit,
}: {
  task: TaskConfig
  currentAnswer: string
  onSubmit: (answer: string) => void
}) {
  const [localAnswer, setLocalAnswer] = useState(currentAnswer)

  if (task.type === 'navigate') {
    return null
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Your Answer
      </Typography>
      {task.answerChoices ? (
        <FormControl>
          <RadioGroup
            value={localAnswer}
            onChange={e => {
              setLocalAnswer(e.target.value)
            }}
          >
            {task.answerChoices.map(choice => (
              <FormControlLabel
                key={choice}
                value={choice}
                control={<Radio />}
                label={choice}
              />
            ))}
          </RadioGroup>
          <Button
            variant="contained"
            size="small"
            sx={{ mt: 1 }}
            onClick={() => {
              onSubmit(localAnswer)
            }}
            disabled={!localAnswer}
          >
            Submit Answer
          </Button>
        </FormControl>
      ) : (
        <Box>
          <TextField
            fullWidth
            size="small"
            value={localAnswer}
            onChange={e => {
              setLocalAnswer(e.target.value)
            }}
            placeholder="Type your answer..."
            sx={{ mb: 1 }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={() => {
              onSubmit(localAnswer)
            }}
            disabled={!localAnswer.trim()}
          >
            Submit Answer
          </Button>
        </Box>
      )}
    </Box>
  )
})

export default AnswerInput
