import { Box, Button, Chip, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { ActionType } from '../../ActionLogger/ActionTypes.ts'
import type { TaskConfig } from '../../RLPipeline/types.ts'
import type GameEngine from '../GameEngine.ts'
import type { NarratorEntry } from '../GameEngine.ts'
import type { ScavengerHuntWidgetModel } from '../model.ts'

import AnswerInput from './AnswerInput.tsx'
import AwardChips from './AwardChips.tsx'
import CompletionScreen from './CompletionScreen.tsx'
import NarratorLog from './NarratorLog.tsx'
import ProgressBar from './ProgressBar.tsx'

/**
 * Module-level reference to the GameEngine instance.
 * Set by the plugin in configure(), read by the widget.
 */
let gameEngineRef: GameEngine | null = null

export function setGameEngine(engine: GameEngine) {
  gameEngineRef = engine
}

const ScavengerHuntWidget = observer(function ScavengerHuntWidget({
  model,
}: {
  model: ScavengerHuntWidgetModel
}) {
  const [, forceUpdate] = useState(0)
  const startedTaskRef = useRef<string | null>(null)
  const engine = gameEngineRef

  // Re-render when engine state changes
  useEffect(() => {
    if (engine) {
      engine.setOnChange(() => {
        forceUpdate(n => n + 1)
      })
    }
  }, [engine])

  // Start task when currentTask changes
  const currentTask = model.currentTask as TaskConfig | undefined
  useEffect(() => {
    if (currentTask && engine && startedTaskRef.current !== currentTask.id) {
      startedTaskRef.current = currentTask.id
      model.startCurrentTask()
      engine.startTask(currentTask)
    }
  }, [currentTask, engine, model])

  if (!engine) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2">Initializing...</Typography>
      </Box>
    )
  }

  const narratorLog = engine.getNarratorLog() as NarratorEntry[]

  // Completion screen
  if (model.isComplete) {
    if (!model.completionCode) {
      void model.generateCompletionCode()
    }
    return (
      <Box sx={{ p: 2 }}>
        <NarratorLog entries={narratorLog} />
        <CompletionScreen model={model} />
      </Box>
    )
  }

  if (!currentTask) {
    return (
      <Box sx={{ p: 2 }}>
        <NarratorLog entries={narratorLog} />
        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
          Waiting for tasks...
        </Typography>
      </Box>
    )
  }

  // Check tier gating
  const missingAwards = engine.getMissingAwards(currentTask)
  const isGated = missingAwards.length > 0

  const needsTextAnswer =
    currentTask.type === 'identify' ||
    currentTask.type === 'compare' ||
    currentTask.type === 'freeform'

  const handleSubmit = useCallback(() => {
    engine.tryAutoValidate()
  }, [engine])

  const tierLabel = ['Hook', 'Discovery', 'Competence', 'Expertise', 'Mastery'][
    currentTask.tier
  ]

  return (
    <Box sx={{ p: 2 }}>
      {/* Header: tier + progress */}
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

      {/* Awards earned */}
      <AwardChips model={model} />

      {/* Scrollable narrator history */}
      <NarratorLog entries={narratorLog} />

      {/* Tier gate or active task */}
      {isGated ? (
        <Box sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 1, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Before continuing:
          </Typography>
          {missingAwards.map(id => {
            const def = model.awardDefinitions.find(
              (a: { id: string }) => a.id === id,
            )
            return (
              <Typography key={id} variant="body2" sx={{ ml: 1 }}>
                Earn &quot;{def?.name ?? id}&quot;
              </Typography>
            )
          })}
        </Box>
      ) : (
        <>
          {/* Current task */}
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

          {/* Text answer input */}
          {needsTextAnswer && (
            <>
              <AnswerInput
                task={currentTask}
                currentAnswer={model.answers.get(currentTask.id) ?? ''}
                onSubmit={answer => {
                  model.submitAnswer(answer)
                  engine.onAnswerSubmit(answer)
                }}
              />
              <Button
                variant="outlined"
                size="small"
                sx={{ mt: 1 }}
                onClick={handleSubmit}
              >
                Submit
              </Button>
            </>
          )}

          {/* Hints */}
          {currentTask.hints.length > 0 && (
            <Button
              variant="text"
              size="small"
              sx={{ mt: 0.5, fontSize: '0.75rem' }}
              onClick={() => {
                model.revealHint()
              }}
            >
              {model.currentHintsRevealed < currentTask.hints.length
                ? `Need a hint? (${currentTask.hints.length - model.currentHintsRevealed} available)`
                : 'All hints shown'}
            </Button>
          )}
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
                  {hint}
                </Typography>
              ))}
        </>
      )}
    </Box>
  )
})

export default ScavengerHuntWidget
