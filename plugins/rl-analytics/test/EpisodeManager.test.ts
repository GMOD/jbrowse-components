import { ActionType } from '../src/ActionLogger/ActionTypes.ts'
import EpisodeManager from '../src/RLPipeline/EpisodeManager.ts'

function makeAction(type: ActionType = ActionType.PAN) {
  return {
    type,
    timestamp: Date.now(),
    sourceAction: 'horizontalScroll',
    path: '/views/0',
    metadata: { distance: 100 },
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
    manager.recordAction(makeAction(ActionType.ZOOM))
    manager.recordAction(makeAction(ActionType.NAV_TO))
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
    expect(step.action).toBe(ActionType.PAN)
    expect(step.nextState).toBeDefined()
    expect(typeof step.reward).toBe('number')
    expect(typeof step.terminal).toBe('boolean')
  })

  it('episode has id and metadata', () => {
    manager.startEpisode()
    manager.recordAction(makeAction())
    const episode = manager.getAllEpisodes()[0]!
    expect(episode.id).toBeTruthy()
    expect(episode.metadata).toBeDefined()
  })
})
