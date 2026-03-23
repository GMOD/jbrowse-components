import { Box, Button, Chip, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { TaskConfig } from '../../RLPipeline/types.ts'
import type GameEngine from '../GameEngine.ts'
import type { NarratorEntry } from '../GameEngine.ts'
import type { ScavengerHuntViewModel } from '../viewModel.ts'

import AnswerInput from './AnswerInput.tsx'
import AwardChips from './AwardChips.tsx'
import CompletionScreen from './CompletionScreen.tsx'
import NarratorLog from './NarratorLog.tsx'
import ProgressBar from './ProgressBar.tsx'

/**
 * Module-level reference to the GameEngine instance.
 * Set by the plugin in configure(), read by the view.
 */
let gameEngineRef: GameEngine | null = null

export function setGameEngine(engine: GameEngine) {
  gameEngineRef = engine
}

const ScavengerHuntView = observer(function ScavengerHuntView({
  model,
}: {
  model: ScavengerHuntViewModel
}) {
  const [, forceUpdate] = useState(0)
  const startedTaskRef = useRef<string | null>(null)
  const engine = gameEngineRef

  useEffect(() => {
    if (engine) {
      engine.setOnChange(() => {
        forceUpdate(n => n + 1)
      })
    }
  }, [engine])

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

  if (model.isComplete) {
    if (!model.completionCode) {
      void model.generateCompletionCode()
    }
    return (
      <Box sx={{ p: 2, height: model.height, overflow: 'auto' }}>
        <NarratorLog entries={narratorLog} />
        <CompletionScreen model={model} />
      </Box>
    )
  }

  if (!currentTask) {
    return (
      <Box sx={{ p: 2, height: model.height, overflow: 'auto' }}>
        <NarratorLog entries={narratorLog} />
        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
          Waiting for tasks...
        </Typography>
      </Box>
    )
  }

  const missingAwards = engine.getMissingAwards(currentTask)
  const isGated = missingAwards.length > 0

  const needsTextAnswer =
    currentTask.type === 'identify' ||
    currentTask.type === 'compare' ||
    currentTask.type === 'freeform'

  const handleSubmit = () => {
    engine.submitValidation()
  }

  const tierLabel = ['Hook', 'Discovery', 'Competence', 'Expertise', 'Mastery'][
    currentTask.tier
  ]

  return (
    <Box
      sx={{
        height: model.height,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'row',
        gap: 2,
        p: 2,
      }}
    >
      {/* Left: narrator log (scrollable) */}
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        <NarratorLog entries={narratorLog} />
      </Box>

      {/* Right: task panel */}
      <Box sx={{ width: 350, minWidth: 350, overflow: 'auto' }}>
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
              <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
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
                  ? `Hint (${currentTask.hints.length - model.currentHintsRevealed} available)`
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
                    }}
                  >
                    {hint}
                  </Typography>
                ))}
          </>
        )}
      </Box>
    </Box>
  )
})

export default ScavengerHuntView
