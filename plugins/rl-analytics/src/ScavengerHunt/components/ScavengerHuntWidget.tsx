import { Alert, Box, Button, Typography } from '@mui/material'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { useEffect, useState } from 'react'

import type { TaskConfig } from '../../RLPipeline/types.ts'
import type { ScavengerHuntWidgetModel } from '../model.ts'
import TaskValidator from '../TaskValidator.ts'

import AnswerInput from './AnswerInput.tsx'
import CompletionScreen from './CompletionScreen.tsx'
import ProgressBar from './ProgressBar.tsx'
import TaskCard from './TaskCard.tsx'

const ScavengerHuntWidget = observer(function ScavengerHuntWidget({
  model,
}: {
  model: ScavengerHuntWidgetModel
}) {
  const [validationError, setValidationError] = useState<string | null>(null)
  const [taskStarted, setTaskStarted] = useState(false)

  const currentTask = model.currentTask as TaskConfig | undefined

  useEffect(() => {
    if (currentTask && !taskStarted) {
      model.startCurrentTask()
      setTaskStarted(true)
    }
  }, [currentTask, taskStarted, model])

  useEffect(() => {
    setTaskStarted(false)
    setValidationError(null)
  }, [model.currentTaskIndex])

  if (model.isComplete) {
    // Generate completion code on first render
    if (!model.completionCode) {
      // fire and forget
      void model.generateCompletionCode()
    }
    return <CompletionScreen model={model} />
  }

  if (!currentTask) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>No tasks loaded. Load a task set to begin.</Typography>
      </Box>
    )
  }

  const handleValidateAndAdvance = () => {
    // Get the first LinearGenomeView from the session for validation
    const validator = new TaskValidator(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = getSession(model) as any
        return session?.views?.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (v: any) => v.type === 'LinearGenomeView',
        )
      } catch {
        return null
      }
    })
    const result = validator.validate(currentTask, model)
    if (result.valid) {
      model.completeCurrentTask()
      setValidationError(null)
    } else {
      setValidationError(result.reason ?? 'Validation failed')
    }
  }

  return (
    <Box sx={{ p: 2 }}>
      <ProgressBar model={model} />
      <TaskCard
        task={currentTask}
        hintsRevealed={model.currentHintsRevealed}
        onRevealHint={() => {
          model.revealHint()
        }}
      />
      <AnswerInput
        task={currentTask}
        currentAnswer={model.answers.get(currentTask.id) ?? ''}
        onSubmit={answer => {
          model.submitAnswer(answer)
        }}
      />
      {validationError && (
        <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>
          {validationError}
        </Alert>
      )}
      <Button
        variant="contained"
        color="primary"
        sx={{ mt: 2 }}
        onClick={handleValidateAndAdvance}
      >
        {currentTask.type === 'navigate'
          ? 'Check Position'
          : 'Submit & Continue'}
      </Button>
    </Box>
  )
})

export default ScavengerHuntWidget
