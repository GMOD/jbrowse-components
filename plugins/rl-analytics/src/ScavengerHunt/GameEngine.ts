import { ActionType, type ClassifiedAction } from '../ActionLogger/ActionTypes.ts'
import type StateEncoder from '../RLPipeline/StateEncoder.ts'
import type { AwardDefinition, BrowserState, TaskConfig } from '../RLPipeline/types.ts'

import AwardManager from './AwardManager.ts'
import TaskValidator from './TaskValidator.ts'
import locale from './locale/en.ts'

import type { ScavengerHuntWidgetModel } from './model.ts'
import type { TaskSet, ValidationResult } from './tasks/taskSchema.ts'

export interface NarratorEntry {
  id: number
  text: string
  type: 'intro' | 'success' | 'hint' | 'award' | 'system'
  timestamp: number
}

function t(key: string): string {
  return (locale as Record<string, string>)[key] ?? ''
}

/**
 * GameEngine: pure game logic, no React.
 *
 * Owns: task lifecycle, award checking, narrator events, validation.
 * Does NOT own: rendering, MST model mutations (calls into model via callbacks).
 *
 * The engine is driven by two inputs:
 * 1. Actions from the PatchListener (via onAction)
 * 2. State snapshots from the StateEncoder (via onStateChange)
 */
export default class GameEngine {
  private awardManager = new AwardManager()
  private actionLog: ActionType[] = []
  private narratorLog: NarratorEntry[] = []
  private nextEntryId = 0
  private taskStartTimestamp = 0
  private lastValidationResult: ValidationResult | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getView: (() => any) | null = null
  private model: ScavengerHuntWidgetModel | null = null
  private onChange: (() => void) | null = null

  /** Set the view accessor (for TaskValidator) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setViewAccessor(fn: () => any) {
    this.getView = fn
  }

  /** Bind to the MST model (for reading task state and mutating on completion) */
  setModel(model: ScavengerHuntWidgetModel) {
    this.model = model
  }

  /** Set a callback to trigger re-render when game state changes */
  setOnChange(fn: () => void) {
    this.onChange = fn
  }

  /** Load a task set — initializes awards and emits welcome */
  loadTaskSet(taskSet: TaskSet) {
    if (taskSet.awards) {
      this.awardManager.loadAwards(taskSet.awards)
      this.awardManager.onAwardEarned(award => {
        this.onAwardEarned(award)
      })
    }
    this.addNarratorEntry(t('narrator.welcome'), 'system')
  }

  /** Called when a new task becomes current */
  startTask(task: TaskConfig) {
    this.actionLog = []
    this.taskStartTimestamp = Date.now()
    this.lastValidationResult = null
    const line = t(`task.${task.id}.intro`)
    if (line) {
      this.addNarratorEntry(line, 'intro')
    }
  }

  /** Called on every debounced action from the PatchListener */
  onAction(action: ClassifiedAction, state: BrowserState) {
    this.actionLog.push(action.type)
    this.awardManager.checkAction(action, state)
    // Try auto-validation after each action
    this.tryAutoValidate()
  }

  /** Called when the user submits a text answer */
  onAnswerSubmit(answer: string) {
    this.awardManager.checkTextAnswer(answer)
    this.tryAutoValidate()
  }

  /** Try to validate the current task against current state */
  tryAutoValidate(): ValidationResult | null {
    if (!this.model) {
      return null
    }
    const task = this.model.currentTask as TaskConfig | undefined
    if (!task || this.model.isComplete || this.model.isGated) {
      return null
    }

    // Text tasks require an answer to be entered first
    const needsText =
      task.type === 'identify' ||
      task.type === 'compare' ||
      task.type === 'freeform'
    if (needsText && !this.model.answers.get(task.id)) {
      return null
    }

    const validator = new TaskValidator(
      () => this.getView?.() ?? null,
      () => [...this.actionLog],
    )

    const result = validator.validate(task, this.model)
    this.lastValidationResult = result

    if (result.valid) {
      this.completeCurrentTask(task)
    }

    return result
  }

  /** Get the current narrator log (read-only) */
  getNarratorLog(): readonly NarratorEntry[] {
    return this.narratorLog
  }

  /** Get the last validation result (for showing feedback) */
  getLastValidationResult(): ValidationResult | null {
    return this.lastValidationResult
  }

  /** Get earned award IDs */
  getEarnedAwards(): string[] {
    return this.awardManager.getEarnedAwards()
  }

  /** Check if all required awards are met for a task */
  hasRequiredAwards(task: TaskConfig): boolean {
    if (!task.requiredAwards) {
      return true
    }
    return this.awardManager.hasAllAwards(task.requiredAwards)
  }

  /** Get missing awards for current task */
  getMissingAwards(task: TaskConfig): string[] {
    if (!task.requiredAwards) {
      return []
    }
    return task.requiredAwards.filter(id => !this.awardManager.hasAward(id))
  }

  private completeCurrentTask(task: TaskConfig) {
    // Success narrator line
    const line = t(`task.${task.id}.success`)
    if (line) {
      this.addNarratorEntry(line, 'success')
    }

    // Grant task-specific award
    if (task.awardOnComplete) {
      this.awardManager.grant(task.awardOnComplete)
    }

    // Mutate the model
    if (this.model && !this.model.completedTaskIds.includes(task.id)) {
      this.model.completeCurrentTask()
    }

    // Reset for next task
    this.actionLog = []
    this.lastValidationResult = null

    // Start next task if there is one
    const nextTask = this.model?.currentTask as TaskConfig | undefined
    if (nextTask && nextTask.id !== task.id) {
      this.startTask(nextTask)
      this.model?.startCurrentTask()
    } else if (this.model?.isComplete) {
      this.addNarratorEntry(t('narrator.graduation'), 'success')
    }

    this.notifyChange()
  }

  private onAwardEarned(award: AwardDefinition) {
    const line =
      t(`award.${award.id}.earned`) ||
      award.flavorText ||
      award.description
    this.addNarratorEntry(line, 'award')

    // Sync to model
    if (this.model) {
      this.model.addAward(award.id)
    }

    this.notifyChange()
  }

  private addNarratorEntry(text: string, type: NarratorEntry['type']) {
    if (!text) {
      return
    }
    this.narratorLog.push({
      id: this.nextEntryId++,
      text,
      type,
      timestamp: Date.now(),
    })
    this.notifyChange()
  }

  private notifyChange() {
    this.onChange?.()
  }

  dispose() {
    // nothing to clean up currently
  }
}
