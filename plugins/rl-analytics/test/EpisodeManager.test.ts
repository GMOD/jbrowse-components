import { ActionType } from '../src/ActionLogger/ActionTypes.ts'
import EpisodeManager from '../src/RLPipeline/EpisodeManager.ts'

function makeAction(type: ActionType = ActionType.PAN_RIGHT) {
  return {
    type,
    timestamp: Date.now(),
    patch: { op: 'replace' as const, path: '/views/0/offsetPx', value: 100 },
    reversePatch: {
      op: 'replace' as const,
      path: '/views/0/offsetPx',
      value: 0,
    },
    metadata: { deltaPixels: 100 },
  }
}

function makeMockView(overrides: Record<string, unknown> = {}) {
  return {
    bpPerPx: 1,
    offsetPx: 0,
    width: 800,
    displayedRegions: [
      { assemblyName: 'hg38', refName: 'chr1', start: 0, end: 800 },
    ],
    tracks: [],
    dynamicBlocks: { contentBlocks: [] },
    ...overrides,
  }
}

describe('EpisodeManager', () => {
  let manager: EpisodeManager

  beforeEach(() => {
    manager = new EpisodeManager(300_000)
    manager.setViewAccessor(() => makeMockView())
  })

  afterEach(() => {
    manager.dispose()
  })

  it('auto-starts episode on first action', () => {
    manager.recordAction(makeAction())
    expect(manager.currentEpisodeStepCount).toBe(1)
  })

  it('records multiple steps in one episode', () => {
    manager.recordAction(makeAction())
    manager.recordAction(makeAction(ActionType.ZOOM_IN))
    manager.recordAction(makeAction(ActionType.PAN_LEFT))
    expect(manager.currentEpisodeStepCount).toBe(3)
  })

  it('starts a new episode explicitly', () => {
    manager.startEpisode()
    manager.recordAction(makeAction())
    expect(manager.currentEpisodeStepCount).toBe(1)
    expect(manager.getCompletedEpisodes()).toHaveLength(0)
  })

  it('ends episode and moves to completed', () => {
    manager.startEpisode()
    manager.recordAction(makeAction())
    manager.endEpisode('completed')
    expect(manager.getCompletedEpisodes()).toHaveLength(1)
    expect(manager.getCompletedEpisodes()[0]!.outcome).toBe('completed')
  })

  it('abandons current episode when starting new one', () => {
    manager.startEpisode()
    manager.recordAction(makeAction())
    manager.startEpisode()
    expect(manager.getCompletedEpisodes()).toHaveLength(1)
    expect(manager.getCompletedEpisodes()[0]!.outcome).toBe('abandoned')
  })

  it('getAllEpisodes includes current episode', () => {
    manager.startEpisode()
    manager.recordAction(makeAction())
    expect(manager.getAllEpisodes()).toHaveLength(1)
    expect(manager.getAllEpisodes()[0]!.outcome).toBe('in_progress')
  })

  it('episode steps contain state, action, reward, nextState', () => {
    manager.startEpisode()
    manager.recordAction(makeAction())

    const episodes = manager.getAllEpisodes()
    const step = episodes[0]!.steps[0]!
    expect(step.state).toBeDefined()
    expect(step.action).toBe(ActionType.PAN_RIGHT)
    expect(step.nextState).toBeDefined()
    expect(typeof step.reward).toBe('number')
    expect(typeof step.terminal).toBe('boolean')
  })

  it('records task config in episode metadata', () => {
    const taskConfig = {
      id: 'task-1',
      type: 'navigate' as const,
      tier: 1 as const,
      title: 'test',
      description: 'test',
      hints: [],
      completionReward: 10,
    }
    manager.startEpisode(taskConfig)
    manager.recordAction(makeAction())
    const episode = manager.getAllEpisodes()[0]!
    expect(episode.taskId).toBe('task-1')
    expect(episode.metadata.taskConfig).toEqual(taskConfig)
  })
})
