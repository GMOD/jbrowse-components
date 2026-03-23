import type { ActionType } from '../ActionLogger/ActionTypes.ts'
import type { TaskConfig } from '../RLPipeline/types.ts'

import type { ValidationResult } from './tasks/taskSchema.ts'

import type { ScavengerHuntWidgetModel } from './model.ts'

function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) {
    return 1.0
  }
  const len1 = s1.length
  const len2 = s2.length
  if (len1 === 0 || len2 === 0) {
    return 0.0
  }

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1
  const s1Matches = new Array<boolean>(len1).fill(false)
  const s2Matches = new Array<boolean>(len2).fill(false)

  let matches = 0
  let transpositions = 0

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance)
    const end = Math.min(i + matchDistance + 1, len2)
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) {
        continue
      }
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) {
    return 0.0
  }

  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) {
      continue
    }
    while (!s2Matches[k]) {
      k++
    }
    if (s1[i] !== s2[k]) {
      transpositions++
    }
    k++
  }

  const jaro =
    (matches / len1 +
      matches / len2 +
      (matches - transpositions / 2) / matches) /
    3

  let prefix = 0
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) {
      prefix++
    } else {
      break
    }
  }

  return jaro + prefix * 0.1 * (1 - jaro)
}

export default class TaskValidator {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getView: () => any,
    private getActionsSinceTaskStart?: () => ActionType[],
  ) {}

  validate(
    task: TaskConfig,
    model: ScavengerHuntWidgetModel,
  ): ValidationResult {
    // Check minimum time
    const startTime = model.taskStartTimes.get(task.id)
    if (startTime && task.minTimeSeconds) {
      const elapsed = (Date.now() - startTime) / 1000
      if (elapsed < task.minTimeSeconds) {
        return {
          valid: false,
          reason: 'Completed too quickly — please explore more carefully',
        }
      }
    }

    switch (task.type) {
      case 'navigate':
        return this.validateNavigation(task)
      case 'navigate_constrained':
        return this.validateConstrainedNavigation(task)
      case 'action_required':
        return this.validateActionRequired(task)
      case 'identify':
        return this.validateIdentification(task, model)
      case 'compare':
        return this.validateIdentification(task, model)
      case 'freeform':
        return this.validateFreeform(task, model)
    }
  }

  private validateNavigation(task: TaskConfig): ValidationResult {
    if (!task.target) {
      return { valid: false, reason: 'No target defined' }
    }

    const view = this.getView()
    if (!view) {
      return { valid: false, reason: 'No active view' }
    }

    const contentBlocks = view.dynamicBlocks?.contentBlocks ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visible = contentBlocks.some(
      (block: any) =>
        block.refName === task.target!.refName &&
        block.start <= task.target!.end &&
        block.end >= task.target!.start,
    )

    if (!visible) {
      return { valid: false, reason: 'Target region not in viewport' }
    }

    return this.checkRequiredTracks(task)
  }

  private validateConstrainedNavigation(
    task: TaskConfig,
  ): ValidationResult {
    const constraints = task.navigationConstraints
    const actions = this.getActionsSinceTaskStart?.() ?? []
    let searchUsed = false

    if (constraints) {
      // Check required action types — need at least ONE of the listed types
      if (constraints.requiredActionTypes) {
        const actionSet = new Set(actions)
        const hasAny = constraints.requiredActionTypes.some(t =>
          actionSet.has(t as ActionType),
        )
        if (!hasAny) {
          const hints = constraints.requiredActionTypes.map(m =>
            m.toLowerCase().replace(/_/g, ' '),
          )
          return {
            valid: false,
            reason: `Try: ${hints.join(' or ')}`,
          }
        }
      }

      // Check min actions
      if (
        constraints.minActions &&
        actions.length < constraints.minActions
      ) {
        return {
          valid: false,
          reason: 'Keep exploring — interact with the browser a bit more',
        }
      }

      // Check min action diversity
      if (constraints.minActionDiversity) {
        const diversity = new Set(actions).size
        if (diversity < constraints.minActionDiversity) {
          return {
            valid: false,
            reason: 'Try using different controls',
          }
        }
      }

      // Check zoom range
      if (constraints.zoomRange) {
        const view = this.getView()
        if (view) {
          try {
            const bpPerPx = view.bpPerPx ?? 1
            if (
              constraints.zoomRange.max !== undefined &&
              bpPerPx > constraints.zoomRange.max
            ) {
              return { valid: false, reason: 'Zoom in more' }
            }
            if (
              constraints.zoomRange.min !== undefined &&
              bpPerPx < constraints.zoomRange.min
            ) {
              return { valid: false, reason: 'Zoom out more' }
            }
          } catch {
            // view not ready
          }
        }
      }
    }

    searchUsed = actions.includes('SEARCH' as ActionType)

    // If task has a target, also validate position
    if (task.target) {
      const navResult = this.validateNavigation(task)
      if (!navResult.valid) {
        return navResult
      }
    }

    const tracksResult = this.checkRequiredTracks(task)
    if (!tracksResult.valid) {
      return tracksResult
    }

    return { valid: true, searchUsed }
  }

  private validateActionRequired(task: TaskConfig): ValidationResult {
    return this.checkRequiredTracks(task)
  }

  private validateIdentification(
    task: TaskConfig,
    model: ScavengerHuntWidgetModel,
  ): ValidationResult {
    const answer = model.answers.get(task.id)
    if (!answer) {
      return { valid: false, reason: 'No answer provided' }
    }

    const validation = task.answerValidation

    if (validation?.mode === 'keyword_set' && validation.keywords) {
      const lower = answer.toLowerCase()
      const match = validation.keywords.some(kw =>
        lower.includes(kw.toLowerCase()),
      )
      return {
        valid: match,
        reason: match ? undefined : 'Answer not recognized — try again',
      }
    }

    if (validation?.mode === 'any_nonempty') {
      const minLen = validation.minLength ?? 1
      return {
        valid: answer.trim().length >= minLen,
        reason:
          answer.trim().length >= minLen
            ? undefined
            : 'Please provide a longer answer',
      }
    }

    if (task.answerChoices && task.expectedAnswer) {
      return {
        valid: answer === task.expectedAnswer,
        reason:
          answer === task.expectedAnswer ? undefined : 'Incorrect answer',
      }
    }

    if (task.expectedAnswer) {
      const threshold = validation?.fuzzyThreshold ?? 0.85
      const similarity = jaroWinkler(
        answer.toLowerCase(),
        task.expectedAnswer.toLowerCase(),
      )
      return {
        valid: similarity > threshold,
        reason:
          similarity > threshold
            ? undefined
            : 'Answer does not match expected',
      }
    }

    return { valid: true }
  }

  private validateFreeform(
    task: TaskConfig,
    model: ScavengerHuntWidgetModel,
  ): ValidationResult {
    const answer = model.answers.get(task.id)
    if (!answer || answer.trim().length === 0) {
      return { valid: false, reason: 'Please provide an answer' }
    }
    const minLen = task.answerValidation?.minLength ?? 1
    if (answer.trim().length < minLen) {
      return { valid: false, reason: 'Please provide a more detailed answer' }
    }
    if (task.expectedAnswer) {
      const threshold = task.answerValidation?.fuzzyThreshold ?? 0.85
      const similarity = jaroWinkler(
        answer.toLowerCase(),
        task.expectedAnswer.toLowerCase(),
      )
      return {
        valid: similarity > threshold,
        reason:
          similarity > threshold
            ? undefined
            : 'Answer does not match expected',
      }
    }
    return { valid: true }
  }

  private checkRequiredTracks(task: TaskConfig): ValidationResult {
    if (!task.requiredTracks) {
      return { valid: true }
    }
    const view = this.getView()
    if (!view) {
      return { valid: true }
    }
    const activeTrackIds =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      view.tracks?.map((t: any) => t.configuration?.trackId) ?? []
    const missingTracks = task.requiredTracks.filter(
      (t: string) => !activeTrackIds.includes(t),
    )
    if (missingTracks.length > 0) {
      return {
        valid: false,
        reason: `Open the required track: ${missingTracks.join(', ')}`,
      }
    }
    return { valid: true }
  }
}
