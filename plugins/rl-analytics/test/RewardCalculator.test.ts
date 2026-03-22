import { ActionType } from '../src/ActionLogger/ActionTypes.ts'
import RewardCalculator from '../src/RLPipeline/RewardCalculator.ts'

import type { BrowserState } from '../src/RLPipeline/types.ts'

function makeState(overrides: Partial<BrowserState> = {}): BrowserState {
  return {
    bpPerPx: 1,
    offsetPx: 0,
    viewWidthPx: 800,
    assemblyName: 'hg38',
    refName: 'chr1',
    startBp: 0,
    endBp: 800,
    viewportBp: 800,
    activeTracks: [],
    numTracks: 0,
    taskActive: false,
    timeSinceLastAction: 0,
    actionsInLast5Seconds: 0,
    ...overrides,
  }
}

function makeAction(type: ActionType) {
  return {
    type,
    timestamp: Date.now(),
    patch: { op: 'replace' as const, path: '/test', value: 0 },
    reversePatch: { op: 'replace' as const, path: '/test', value: 0 },
    metadata: {},
  }
}

describe('RewardCalculator', () => {
  let calc: RewardCalculator

  beforeEach(() => {
    calc = new RewardCalculator()
  })

  it('applies step penalty without task', () => {
    const reward = calc.calculate(
      makeState(),
      makeAction(ActionType.PAN_RIGHT),
      makeState(),
    )
    expect(reward).toBeCloseTo(-0.01)
  })

  it('gives positive reward for moving closer to target', () => {
    const taskConfig = {
      id: 't1',
      type: 'navigate' as const,
      tier: 1 as const,
      title: 'test',
      description: 'test',
      hints: [],
      completionReward: 10,
    }

    const prevState = makeState({
      taskActive: true,
      distanceToTargetBp: 100000,
    })
    const nextState = makeState({
      taskActive: true,
      distanceToTargetBp: 50000,
    })

    const reward = calc.calculate(
      prevState,
      makeAction(ActionType.PAN_RIGHT),
      nextState,
      taskConfig,
    )
    // Should be positive because we moved closer
    expect(reward).toBeGreaterThan(0)
  })

  it('gives bonus for target becoming visible', () => {
    const taskConfig = {
      id: 't1',
      type: 'navigate' as const,
      tier: 1 as const,
      title: 'test',
      description: 'test',
      hints: [],
      completionReward: 10,
    }

    const prevState = makeState({
      taskActive: true,
      distanceToTargetBp: 1000,
      targetVisible: false,
    })
    const nextState = makeState({
      taskActive: true,
      distanceToTargetBp: 100,
      targetVisible: true,
    })

    const reward = calc.calculate(
      prevState,
      makeAction(ActionType.PAN_RIGHT),
      nextState,
      taskConfig,
    )
    expect(reward).toBeGreaterThanOrEqual(5.0)
  })

  it('gives completion bonus for fully visible target on navigate tasks', () => {
    const taskConfig = {
      id: 't1',
      type: 'navigate' as const,
      tier: 1 as const,
      title: 'test',
      description: 'test',
      hints: [],
      completionReward: 10,
    }

    const prevState = makeState({
      taskActive: true,
      distanceToTargetBp: 100,
      targetVisible: true,
      targetFullyVisible: false,
    })
    const nextState = makeState({
      taskActive: true,
      distanceToTargetBp: 0,
      targetVisible: true,
      targetFullyVisible: true,
    })

    const reward = calc.calculate(
      prevState,
      makeAction(ActionType.ZOOM_OUT),
      nextState,
      taskConfig,
    )
    expect(reward).toBeGreaterThanOrEqual(10.0)
  })

  it('detects oscillation pattern (ABAB)', () => {
    const prev = makeState()
    const next = makeState()

    // Build up ABAB pattern
    calc.calculate(prev, makeAction(ActionType.ZOOM_IN), next)
    calc.calculate(prev, makeAction(ActionType.ZOOM_OUT), next)
    calc.calculate(prev, makeAction(ActionType.ZOOM_IN), next)

    // The 4th action completes the ABAB pattern
    const reward = calc.calculate(
      prev,
      makeAction(ActionType.ZOOM_OUT),
      next,
    )
    expect(reward).toBeLessThan(-0.5)
  })

  it('does not penalize non-oscillating patterns', () => {
    const prev = makeState()
    const next = makeState()

    calc.calculate(prev, makeAction(ActionType.PAN_RIGHT), next)
    calc.calculate(prev, makeAction(ActionType.PAN_RIGHT), next)
    calc.calculate(prev, makeAction(ActionType.PAN_RIGHT), next)
    const reward = calc.calculate(
      prev,
      makeAction(ActionType.PAN_RIGHT),
      next,
    )
    expect(reward).toBeCloseTo(-0.01)
  })
})
