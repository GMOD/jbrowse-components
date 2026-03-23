import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import type { TaskSet } from './tasks/taskSchema.ts'

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

async function sha256Hex(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

const TaskConfigModel = types.model('TaskConfig', {
  id: types.identifier,
  type: types.enumeration(['navigate', 'identify', 'compare', 'freeform']),
  tier: types.union(types.literal(1), types.literal(2), types.literal(3)),
  title: types.string,
  description: types.string,
  hints: types.array(types.string),
  target: types.maybe(
    types.model({
      assemblyName: types.string,
      refName: types.string,
      start: types.number,
      end: types.number,
    }),
  ),
  expectedAnswer: types.maybe(types.string),
  answerChoices: types.maybe(types.array(types.string)),
  validationFn: types.maybe(types.string),
  minTimeSeconds: types.maybe(types.number),
  maxTimeSeconds: types.maybe(types.number),
  requiredTracks: types.maybe(types.array(types.string)),
  completionReward: types.optional(types.number, 1),
})

export const configSchema = ConfigurationSchema('ScavengerHuntWidget', {})

export const ScavengerHuntModel = types
  .model('ScavengerHuntWidget', {
    id: ElementId,
    type: types.literal('ScavengerHuntWidget'),
    taskSetId: types.optional(types.string, ''),
    tasks: types.array(TaskConfigModel),
    currentTaskIndex: types.optional(types.number, 0),
    taskOrder: types.array(types.number),
    completedTaskIds: types.array(types.string),
    taskStartTimes: types.map(types.number),
    taskEndTimes: types.map(types.number),
    hintsRevealed: types.map(types.number),
    answers: types.map(types.string),
    workerId: types.optional(types.string, ''),
    assignmentId: types.optional(types.string, ''),
  })
  .volatile(() => ({
    completionCode: null as string | null,
  }))
  .views(self => ({
    get currentTask() {
      const idx = self.taskOrder[self.currentTaskIndex]
      return idx !== undefined ? self.tasks[idx] : undefined
    },
    get progress() {
      return self.tasks.length > 0
        ? self.completedTaskIds.length / self.tasks.length
        : 0
    },
    get isComplete() {
      return (
        self.tasks.length > 0 &&
        self.completedTaskIds.length === self.tasks.length
      )
    },
    get currentHintsRevealed() {
      const task = self.taskOrder[self.currentTaskIndex]
      const taskModel = task !== undefined ? self.tasks[task] : undefined
      if (!taskModel) {
        return 0
      }
      return self.hintsRevealed.get(taskModel.id) ?? 0
    },
  }))
  .actions(self => ({
    loadTaskSet(taskSet: TaskSet) {
      self.tasks.clear()
      for (const task of taskSet.tasks) {
        self.tasks.push(task)
      }
      self.taskSetId = taskSet.id
      const indices = [...Array(taskSet.tasks.length).keys()]
      self.taskOrder.clear()
      const order = taskSet.randomizeOrder ? shuffleArray(indices) : indices
      for (const i of order) {
        self.taskOrder.push(i)
      }
    },
    startCurrentTask() {
      const task = self.currentTask
      if (task) {
        self.taskStartTimes.set(task.id, Date.now())
      }
    },
    revealHint() {
      const task = self.currentTask
      if (!task) {
        return
      }
      const current = self.hintsRevealed.get(task.id) ?? 0
      if (current < task.hints.length) {
        self.hintsRevealed.set(task.id, current + 1)
      }
    },
    submitAnswer(answer: string) {
      const task = self.currentTask
      if (!task) {
        return
      }
      self.answers.set(task.id, answer)
    },
    completeCurrentTask() {
      const task = self.currentTask
      if (!task) {
        return
      }
      self.taskEndTimes.set(task.id, Date.now())
      self.completedTaskIds.push(task.id)
      if (self.currentTaskIndex < self.tasks.length - 1) {
        self.currentTaskIndex += 1
      }
    },
    setWorkerId(id: string) {
      self.workerId = id
    },
    setAssignmentId(id: string) {
      self.assignmentId = id
    },
    setCompletionCode(code: string) {
      self.completionCode = code
    },
    generateCompletionCode() {
      const payload = `${self.assignmentId}:${self.taskSetId}:${self.completedTaskIds.join(',')}`
      void sha256Hex(payload).then(hash => {
        // Must call a named action — can't set volatile directly from async
        this.setCompletionCode(hash.slice(0, 12).toUpperCase())
      })
    },
  }))

export type ScavengerHuntStateModel = typeof ScavengerHuntModel
export type ScavengerHuntWidgetModel = ReturnType<
  typeof ScavengerHuntModel.create
>
