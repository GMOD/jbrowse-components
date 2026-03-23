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
import FloatingPanel from './FloatingPanel.tsx'
import NarratorLog, { type NarratorEntry } from './NarratorLog.tsx'
import ProgressBar from './ProgressBar.tsx'
import TierGate from './TierGate.tsx'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let actionLogRef: any[] = []
let nextEntryId = 0

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

function t(key: string): string {
  return (locale as Record<string, string>)[key] ?? ''
}

const ScavengerHuntWidget = observer(function ScavengerHuntWidget({
  model,
}: {
  model: ScavengerHuntWidgetModel
}) {
  const [narratorLog, setNarratorLog] = useState<NarratorEntry[]>([])
  const [taskStarted, setTaskStarted] = useState(false)
  const autoValidateRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentTask = model.currentTask as TaskConfig | undefined

  const addNarratorEntry = useCallback(
    (text: string, type: NarratorEntry['type']) => {
      if (!text) {
        return
      }
      setNarratorLog(prev => [...prev, { id: nextEntryId++, text, type }])
    },
    [],
  )

  const makeValidator = useCallback(
    () =>
      new TaskValidator(
        () => getView(model),
        () => [...actionLogRef] as ActionType[],
      ),
    [model],
  )

  // Auto-advance: validate every 500ms
  useEffect(() => {
    if (!currentTask || model.isGated || model.isComplete) {
      return
    }

    const needsTextAnswer =
      currentTask.type === 'identify' ||
      currentTask.type === 'compare' ||
      currentTask.type === 'freeform'

    autoValidateRef.current = setInterval(() => {
      if (needsTextAnswer && !model.answers.get(currentTask.id)) {
        return
      }

      const validator = makeValidator()
      const result = validator.validate(currentTask, model)

      if (result.valid) {
        const line = t(`task.${currentTask.id}.success`)
        if (line) {
          addNarratorEntry(line, 'success')
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
  }, [currentTask, model, model.isGated, model.isComplete, makeValidator, addNarratorEntry])

  // Show intro narrator line when task starts
  useEffect(() => {
    if (currentTask && !taskStarted) {
      model.startCurrentTask()
      resetActionLog()
      setTaskStarted(true)

      const line = t(`task.${currentTask.id}.intro`)
      if (line) {
        addNarratorEntry(line, 'intro')
      }
    }
  }, [currentTask, taskStarted, model, addNarratorEntry])

  // Show welcome message on first mount
  useEffect(() => {
    const welcomeLine = t('narrator.welcome')
    if (welcomeLine) {
      addNarratorEntry(welcomeLine, 'system')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setTaskStarted(false)
    resetActionLog()
  }, [model.currentTaskIndex])

  // Watch for new awards and log them
  useEffect(() => {
    const award = model.latestAward
    if (award) {
      const line = t(`award.${award.id}.earned`) || award.flavorText || award.description
      addNarratorEntry(line, 'award')
    }
  }, [model.latestAward, addNarratorEntry])

  const renderContent = () => {
    if (model.isComplete) {
      if (!model.completionCode) {
        void model.generateCompletionCode()
      }
      addNarratorEntry(t('narrator.graduation'), 'success')
      return <CompletionScreen model={model} />
    }

    if (!currentTask) {
      return (
        <Typography variant="body2" sx={{ p: 2, fontStyle: 'italic' }}>
          Waiting for tasks...
        </Typography>
      )
    }

    const needsTextAnswer =
      currentTask.type === 'identify' ||
      currentTask.type === 'compare' ||
      currentTask.type === 'freeform'

    const handleManualSubmit = () => {
      const validator = makeValidator()
      const result = validator.validate(currentTask, model)
      if (result.valid) {
        const line = t(`task.${currentTask.id}.success`)
        if (line) {
          addNarratorEntry(line, 'success')
        }
        if (currentTask.awardOnComplete) {
          model.addAward(currentTask.awardOnComplete)
        }
        model.completeCurrentTask()
      } else {
        addNarratorEntry(
          result.reason ?? t('validate.answer_wrong'),
          'hint',
        )
      }
    }

    const tierLabel = ['Hook', 'Discovery', 'Competence', 'Expertise', 'Mastery'][
      currentTask.tier
    ]

    return (
      <>
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
            {/* Current task description */}
            <Box
              sx={{
                p: 1.5,
                mb: 1,
                bgcolor: 'grey.50',
                borderRadius: 1,
                borderLeft: 3,
                borderColor: 'primary.main',
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                {currentTask.title}
              </Typography>
              <Typography variant="body2">
                {currentTask.description}
              </Typography>
            </Box>

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

            {/* Hints */}
            {model.currentHintsRevealed > 0 &&
              currentTask.hints
                .slice(0, model.currentHintsRevealed)
                .map((hint, i) => (
                  <Typography
                    key={i}
                    variant="caption"
                    sx={{
                      display: 'block',
                      mt: 0.5,
                      p: 0.75,
                      bgcolor: 'info.light',
                      color: 'info.contrastText',
                      borderRadius: 0.5,
                      fontSize: '0.75rem',
                    }}
                  >
                    Hint: {hint}
                  </Typography>
                ))}
            {model.currentHintsRevealed < currentTask.hints.length && (
              <Button
                variant="text"
                size="small"
                sx={{ mt: 0.5, fontSize: '0.75rem' }}
                onClick={() => {
                  model.revealHint()
                }}
              >
                Need a hint? ({currentTask.hints.length - model.currentHintsRevealed} available)
              </Button>
            )}
          </>
        )}
      </>
    )
  }

  return (
    <FloatingPanel title="Quest">
      <Box sx={{ p: 1.5 }}>
        {/* Scrollable narrator history */}
        <NarratorLog entries={narratorLog} />

        {/* Active task content */}
        {renderContent()}

        <AwardSnackbar model={model} />
      </Box>
    </FloatingPanel>
  )
})

export default ScavengerHuntWidget
