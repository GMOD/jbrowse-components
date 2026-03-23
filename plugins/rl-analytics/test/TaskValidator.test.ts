import TaskValidator from '../src/ScavengerHunt/TaskValidator.ts'

import type { TaskConfig } from '../src/RLPipeline/types.ts'
import type { ScavengerHuntWidgetModel } from '../src/ScavengerHunt/model.ts'

function makeMockView(overrides: Record<string, unknown> = {}) {
  return {
    dynamicBlocks: {
      contentBlocks: [
        {
          refName: 'chr7',
          start: 54_990_000,
          end: 55_010_000,
        },
      ],
    },
    tracks: [
      { configuration: { trackId: 'genes' } },
      { configuration: { trackId: 'variants' } },
    ],
    ...overrides,
  }
}

function makeMockModel(
  overrides: Partial<{
    answers: Map<string, string>
    taskStartTimes: Map<string, number>
  }> = {},
) {
  return {
    answers: overrides.answers ?? new Map<string, string>(),
    taskStartTimes: overrides.taskStartTimes ?? new Map<string, number>(),
  } as unknown as ScavengerHuntWidgetModel
}

describe('TaskValidator', () => {
  describe('navigate tasks', () => {
    it('validates when target is in viewport', () => {
      const validator = new TaskValidator(() => makeMockView())
      const task: TaskConfig = {
        id: 'nav-1',
        type: 'navigate',
        tier: 1,
        title: 'Navigate to chr7',
        description: 'test',
        hints: [],
        target: {
          assemblyName: 'hg38',
          refName: 'chr7',
          start: 55_000_000,
          end: 55_005_000,
        },
        completionReward: 1,
      }

      const result = validator.validate(task, makeMockModel())
      expect(result.valid).toBe(true)
    })

    it('fails when target is not in viewport', () => {
      const validator = new TaskValidator(() =>
        makeMockView({
          dynamicBlocks: {
            contentBlocks: [
              { refName: 'chr1', start: 0, end: 1000 },
            ],
          },
        }),
      )
      const task: TaskConfig = {
        id: 'nav-1',
        type: 'navigate',
        tier: 1,
        title: 'Navigate',
        description: 'test',
        hints: [],
        target: {
          assemblyName: 'hg38',
          refName: 'chr7',
          start: 55_000_000,
          end: 55_005_000,
        },
        completionReward: 1,
      }

      const result = validator.validate(task, makeMockModel())
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('not in viewport')
    })

    it('fails when no target defined', () => {
      const validator = new TaskValidator(() => makeMockView())
      const task: TaskConfig = {
        id: 'nav-1',
        type: 'navigate',
        tier: 1,
        title: 'Navigate',
        description: 'test',
        hints: [],
        completionReward: 1,
      }

      const result = validator.validate(task, makeMockModel())
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('No target')
    })

    it('fails when required tracks are missing', () => {
      const validator = new TaskValidator(() =>
        makeMockView({ tracks: [] }),
      )
      const task: TaskConfig = {
        id: 'nav-1',
        type: 'navigate',
        tier: 1,
        title: 'Navigate',
        description: 'test',
        hints: [],
        target: {
          assemblyName: 'hg38',
          refName: 'chr7',
          start: 55_000_000,
          end: 55_005_000,
        },
        requiredTracks: ['genes'],
        completionReward: 1,
      }

      const result = validator.validate(task, makeMockModel())
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('required track')
    })

    it('fails when completed too quickly', () => {
      const validator = new TaskValidator(() => makeMockView())
      const task: TaskConfig = {
        id: 'nav-1',
        type: 'navigate',
        tier: 1,
        title: 'Navigate',
        description: 'test',
        hints: [],
        target: {
          assemblyName: 'hg38',
          refName: 'chr7',
          start: 55_000_000,
          end: 55_005_000,
        },
        minTimeSeconds: 10,
        completionReward: 1,
      }

      const model = makeMockModel({
        taskStartTimes: new Map([['nav-1', Date.now()]]),
      })

      const result = validator.validate(task, model)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('too quickly')
    })
  })

  describe('identify tasks', () => {
    it('validates correct multiple-choice answer', () => {
      const validator = new TaskValidator(() => null)
      const task: TaskConfig = {
        id: 'id-1',
        type: 'identify',
        tier: 2,
        title: 'Attention check',
        description: 'test',
        hints: [],
        answerChoices: ['Red', 'Blue', 'Green'],
        expectedAnswer: 'Blue',
        completionReward: 0.5,
      }

      const model = makeMockModel({
        answers: new Map([['id-1', 'Blue']]),
      })

      const result = validator.validate(task, model)
      expect(result.valid).toBe(true)
    })

    it('rejects incorrect multiple-choice answer', () => {
      const validator = new TaskValidator(() => null)
      const task: TaskConfig = {
        id: 'id-1',
        type: 'identify',
        tier: 2,
        title: 'Attention check',
        description: 'test',
        hints: [],
        answerChoices: ['Red', 'Blue', 'Green'],
        expectedAnswer: 'Blue',
        completionReward: 0.5,
      }

      const model = makeMockModel({
        answers: new Map([['id-1', 'Red']]),
      })

      const result = validator.validate(task, model)
      expect(result.valid).toBe(false)
    })

    it('fails when no answer provided', () => {
      const validator = new TaskValidator(() => null)
      const task: TaskConfig = {
        id: 'id-1',
        type: 'identify',
        tier: 2,
        title: 'test',
        description: 'test',
        hints: [],
        expectedAnswer: 'Blue',
        completionReward: 0.5,
      }

      const result = validator.validate(task, makeMockModel())
      expect(result.valid).toBe(false)
    })

    it('uses fuzzy matching for free-text answers', () => {
      const validator = new TaskValidator(() => null)
      const task: TaskConfig = {
        id: 'id-1',
        type: 'identify',
        tier: 2,
        title: 'test',
        description: 'test',
        hints: [],
        expectedAnswer: 'chromosome',
        completionReward: 0.5,
      }

      const model = makeMockModel({
        answers: new Map([['id-1', 'chromosme']]), // typo
      })

      const result = validator.validate(task, model)
      expect(result.valid).toBe(true) // jaro-winkler should be > 0.85
    })
  })
})
