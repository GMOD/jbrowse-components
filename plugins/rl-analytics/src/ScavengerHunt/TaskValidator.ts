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
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3

  // Winkler adjustment
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private getView: () => any) {}

  validate(
    task: TaskConfig,
    model: ScavengerHuntWidgetModel,
  ): ValidationResult {
    switch (task.type) {
      case 'navigate':
        return this.validateNavigation(task, model)
      case 'identify':
        return this.validateIdentification(task, model)
      case 'compare':
        return this.validateComparison(task, model)
      case 'freeform':
        return this.validateFreeform(task, model)
    }
  }

  private validateNavigation(
    task: TaskConfig,
    model: ScavengerHuntWidgetModel,
  ): ValidationResult {
    if (!task.target) {
      return { valid: false, reason: 'No target defined' }
    }

    const view = this.getView()
    if (!view) {
      return { valid: false, reason: 'No active view' }
    }

    // Check if target region is visible
    const contentBlocks = view.dynamicBlocks?.contentBlocks ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visible = contentBlocks.some((block: any) =>
      block.refName === task.target!.refName &&
      block.start <= task.target!.end &&
      block.end >= task.target!.start,
    )

    if (!visible) {
      return { valid: false, reason: 'Target region not in viewport' }
    }

    // Check required tracks
    if (task.requiredTracks) {
      const activeTrackIds =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view.tracks?.map((t: any) => t.configuration?.trackId) ?? []
      const missingTracks = task.requiredTracks.filter(
        (t: string) => !activeTrackIds.includes(t),
      )
      if (missingTracks.length > 0) {
        return {
          valid: false,
          reason: `Missing tracks: ${missingTracks.join(', ')}`,
        }
      }
    }

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

    return { valid: true }
  }

  private validateIdentification(
    task: TaskConfig,
    model: ScavengerHuntWidgetModel,
  ): ValidationResult {
    const answer = model.answers.get(task.id)
    if (!answer) {
      return { valid: false, reason: 'No answer provided' }
    }

    if (task.answerChoices && task.expectedAnswer) {
      return {
        valid: answer === task.expectedAnswer,
        reason:
          answer === task.expectedAnswer ? undefined : 'Incorrect answer',
      }
    }

    if (task.expectedAnswer) {
      const similarity = jaroWinkler(
        answer.toLowerCase(),
        task.expectedAnswer.toLowerCase(),
      )
      return {
        valid: similarity > 0.85,
        reason:
          similarity > 0.85 ? undefined : 'Answer does not match expected',
      }
    }

    return { valid: true }
  }

  private validateComparison(
    task: TaskConfig,
    model: ScavengerHuntWidgetModel,
  ): ValidationResult {
    // Comparison tasks require an answer and visible target
    const answer = model.answers.get(task.id)
    if (!answer) {
      return { valid: false, reason: 'No answer provided' }
    }
    if (task.expectedAnswer) {
      const similarity = jaroWinkler(
        answer.toLowerCase(),
        task.expectedAnswer.toLowerCase(),
      )
      return {
        valid: similarity > 0.85,
        reason:
          similarity > 0.85 ? undefined : 'Answer does not match expected',
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
    if (task.expectedAnswer) {
      const similarity = jaroWinkler(
        answer.toLowerCase(),
        task.expectedAnswer.toLowerCase(),
      )
      return {
        valid: similarity > 0.85,
        reason:
          similarity > 0.85 ? undefined : 'Answer does not match expected',
      }
    }
    // For truly freeform tasks, any non-empty answer is valid
    return { valid: true }
  }
}
