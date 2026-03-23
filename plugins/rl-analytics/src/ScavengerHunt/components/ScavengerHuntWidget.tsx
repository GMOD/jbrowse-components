import { Alert, Box, Button, Chip, Typography } from '@mui/material'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { useEffect, useState } from 'react'

import type { ActionType } from '../../ActionLogger/ActionTypes.ts'
import type { TaskConfig } from '../../RLPipeline/types.ts'
import type { ScavengerHuntWidgetModel } from '../model.ts'
import TaskValidator from '../TaskValidator.ts'

import AnswerInput from './AnswerInput.tsx'
import AwardChips from './AwardChips.tsx'
import AwardSnackbar from './AwardSnackbar.tsx'
import CompletionScreen from './CompletionScreen.tsx'
import ProgressBar from './ProgressBar.tsx'
import TaskCard from './TaskCard.tsx'
import TierGate from './TierGate.tsx'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let actionLogRef: any[] = []

/** Called by the plugin to feed actions into the widget for validation */
export function pushActionForValidation(actionType: ActionType) {
  actionLogRef.push(actionType)
}

export function resetActionLog() {
  actionLogRef = []
}

function getView(model: ScavengerHuntWidgetModel) {
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
}

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
      resetActionLog()
      setTaskStarted(true)
    }
  }, [currentTask, taskStarted, model])

  useEffect(() => {
    setTaskStarted(false)
    setValidationError(null)
    resetActionLog()
  }, [model.currentTaskIndex])

  if (model.isComplete) {
    if (!model.completionCode) {
      void model.generateCompletionCode()
    }
    return (
      <>
        <CompletionScreen model={model} />
        <AwardSnackbar model={model} />
      </>
    )
  }

  if (!currentTask) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>No tasks loaded. Load a task set to begin.</Typography>
      </Box>
    )
  }

  const handleSubmit = () => {
    // For tasks with text input, save the answer first
    // (The AnswerInput component's onSubmit already calls model.submitAnswer,
    // but the user might click "Check" without clicking "Submit Answer" first)

    const validator = new TaskValidator(
      () => getView(model),
      () => [...actionLogRef] as ActionType[],
    )

    // If gated by awards, show the gate instead
    if (model.isGated) {
      return
    }

    const result = validator.validate(currentTask, model)
    if (result.valid) {
      // Grant task-specific award
      if (currentTask.awardOnComplete) {
        model.addAward(currentTask.awardOnComplete)
      }
      model.completeCurrentTask()
      setValidationError(null)
    } else {
      model.incrementRetry()
      const maxRetries = currentTask.maxRetries ?? 3
      if (
        model.currentRetryCount >= maxRetries &&
        currentTask.autoAdvanceOnFail !== false
      ) {
        // Auto-advance after max retries
        model.completeCurrentTask()
        setValidationError(null)
      } else {
        setValidationError(result.reason ?? 'Validation failed')
      }
    }
  }

  // Determine button label based on task type
  const needsAnswer =
    currentTask.type === 'identify' ||
    currentTask.type === 'compare' ||
    currentTask.type === 'freeform'
  const buttonLabel =
    currentTask.type === 'navigate' || currentTask.type === 'navigate_constrained'
      ? 'Check'
      : currentTask.type === 'action_required'
        ? 'Verify'
        : 'Submit'

  const tierLabel = ['Hook', 'Discovery', 'Competence', 'Expertise', 'Mastery'][
    currentTask.tier
  ]

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Chip
          label={tierLabel}
          size="small"
          color={
            currentTask.tier <= 1
              ? 'success'
              : currentTask.tier <= 2
                ? 'warning'
                : 'error'
          }
          variant="outlined"
        />
        <ProgressBar model={model} />
      </Box>

      <AwardChips model={model} />

      {model.isGated ? (
        <TierGate model={model} />
      ) : (
        <>
          <TaskCard
            task={currentTask}
            hintsRevealed={model.currentHintsRevealed}
            onRevealHint={() => {
              model.revealHint()
            }}
          />
          {needsAnswer && (
            <AnswerInput
              task={currentTask}
              currentAnswer={model.answers.get(currentTask.id) ?? ''}
              onSubmit={answer => {
                model.submitAnswer(answer)
              }}
            />
          )}
          {validationError && (
            <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>
              {validationError}
            </Alert>
          )}
          <Button
            variant="contained"
            color="primary"
            sx={{ mt: 2 }}
            onClick={handleSubmit}
          >
            {buttonLabel}
          </Button>
        </>
      )}

      <AwardSnackbar model={model} />
    </Box>
  )
})

export default ScavengerHuntWidget
