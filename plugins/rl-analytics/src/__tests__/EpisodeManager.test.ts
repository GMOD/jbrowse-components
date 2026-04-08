import { ActionType } from '../ActionLogger/ActionTypes.ts'
import EpisodeManager from '../RLPipeline/EpisodeManager.ts'

function makeAction(type: ActionType = ActionType.PAN) {
  return {
    type,
    timestamp: Date.now(),
    sourceAction: 'horizontalScroll',
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
    manager = new EpisodeManager(300_000, 100)
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

  it('caches prevState between steps', () => {
    manager.recordAction(makeAction())
    manager.recordAction(makeAction(ActionType.ZOOM))
    const episodes = manager.getAllEpisodes()
    if (episodes[0]!.steps.length >= 2) {
      const step1 = episodes[0]!.steps[0]!
      const step2 = episodes[0]!.steps[1]!
      expect(step2.state.bpPerPx).toBe(step1.nextState.bpPerPx)
    }
  })

  it('evicts oldest episodes when over maxEpisodes', () => {
    const small = new EpisodeManager(300_000, 3)
    small.setViewAccessor(() => makeMockView())
    for (let i = 0; i < 5; i++) {
      small.startEpisode()
      small.recordAction(makeAction())
      small.endEpisode('completed')
    }
    expect(small.getCompletedEpisodes()).toHaveLength(3)
    small.dispose()
  })

  it('sets reward to 0', () => {
    manager.recordAction(makeAction())
    const step = manager.getAllEpisodes()[0]!.steps[0]!
    expect(step.reward).toBe(0)
  })
})
