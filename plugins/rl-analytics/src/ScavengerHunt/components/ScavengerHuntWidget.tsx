import { Box, Button, Chip, Typography } from '@mui/material'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { ActionType } from '../../ActionLogger/ActionTypes.ts'
import type { TaskConfig } from '../../RLPipeline/types.ts'
import locale from '../locale/en.ts'
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

function getNarratorLine(key: string): string {
  return (locale as Record<string, string>)[key] ?? ''
}

const ScavengerHuntWidget = observer(function ScavengerHuntWidget({
  model,
}: {
  model: ScavengerHuntWidgetModel
}) {
  const [narratorMessage, setNarratorMessage] = useState<string | null>(null)
  const [narratorType, setNarratorType] = useState<'info' | 'success'>('info')
  const [taskStarted, setTaskStarted] = useState(false)
  const autoValidateRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentTask = model.currentTask as TaskConfig | undefined

  const makeValidator = useCallback(
    () =>
      new TaskValidator(
        () => getView(model),
        () => [...actionLogRef] as ActionType[],
      ),
    [model],
  )

  // Auto-advance: validate every 500ms for non-text tasks
  useEffect(() => {
    if (!currentTask || model.isGated || model.isComplete) {
      return
    }

    const needsTextAnswer =
      currentTask.type === 'identify' ||
      currentTask.type === 'compare' ||
      currentTask.type === 'freeform'

    // For text tasks, only auto-validate when an answer exists
    // For action/nav tasks, validate continuously
    autoValidateRef.current = setInterval(() => {
      if (needsTextAnswer && !model.answers.get(currentTask.id)) {
        return
      }

      const validator = makeValidator()
      const result = validator.validate(currentTask, model)

      if (result.valid) {
        // Success! Show narrator line and advance
        const successKey = `task.${currentTask.id}.success`
        const line = getNarratorLine(successKey)
        if (line) {
          setNarratorMessage(line)
          setNarratorType('success')
        }
        if (currentTask.awardOnComplete) {
          model.addAward(currentTask.awardOnComplete)
        }
        model.completeCurrentTask()
      }
    }, 500)

    return () => {
      if (autoValidateRef.current) {
        clearInterval(autoValidateRef.current)
      }
    }
  }, [currentTask, model, model.isGated, model.isComplete, makeValidator])

  // Show intro narrator line when task starts
  useEffect(() => {
    if (currentTask && !taskStarted) {
      model.startCurrentTask()
      resetActionLog()
      setTaskStarted(true)

      const introKey = `task.${currentTask.id}.intro`
      const line = getNarratorLine(introKey)
      if (line) {
        setNarratorMessage(line)
        setNarratorType('info')
      } else {
        setNarratorMessage(null)
      }
    }
  }, [currentTask, taskStarted, model])

  useEffect(() => {
    setTaskStarted(false)
    setNarratorMessage(null)
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
        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
          {getNarratorLine('narrator.welcome')}
        </Typography>
      </Box>
    )
  }

  const needsTextAnswer =
    currentTask.type === 'identify' ||
    currentTask.type === 'compare' ||
    currentTask.type === 'freeform'

  // Manual submit only for text-answer tasks (as a convenience,
  // since auto-validation checks text answers too once submitted)
  const handleManualSubmit = () => {
    const validator = makeValidator()
    const result = validator.validate(currentTask, model)
    if (result.valid) {
      if (currentTask.awardOnComplete) {
        model.addAward(currentTask.awardOnComplete)
      }
      model.completeCurrentTask()
    } else {
      setNarratorMessage(result.reason ?? getNarratorLine('validate.answer_wrong'))
      setNarratorType('info')
    }
  }

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

          {/* Narrator message */}
          {narratorMessage && (
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                mb: 1,
                p: 1.5,
                bgcolor: narratorType === 'success' ? 'success.main' : 'grey.100',
                color: narratorType === 'success' ? 'success.contrastText' : 'text.primary',
                borderRadius: 1,
                fontStyle: 'italic',
                transition: 'all 0.3s ease',
              }}
            >
              {narratorMessage}
            </Typography>
          )}

          {needsTextAnswer && (
            <>
              <AnswerInput
                task={currentTask}
                currentAnswer={model.answers.get(currentTask.id) ?? ''}
                onSubmit={answer => {
                  model.submitAnswer(answer)
                }}
              />
              <Button
                variant="outlined"
                size="small"
                sx={{ mt: 1 }}
                onClick={handleManualSubmit}
              >
                Submit
              </Button>
            </>
          )}
        </>
      )}

      <AwardSnackbar model={model} />
    </Box>
  )
})

export default ScavengerHuntWidget
