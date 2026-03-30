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
    zoomLevel: 'gene',
    activeTracks: [],
    numTracks: 0,
    visibleContentBlocks: 0,
    hasReferenceSequence: false,
    hasGeneTrack: false,
    hasAlignmentTrack: false,
    hasVariantTrack: false,
    hasQuantitativeTrack: false,
    timeSinceLastAction: 0,
    actionsInLast5Seconds: 0,
    sessionDurationMs: 0,
    actionCountsByType: {},
    uniqueRefNamesVisited: [],
    totalActionsThisSession: 0,
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

  it('applies step penalty', () => {
    const reward = calc.calculate(
      makeState(),
      makeAction(ActionType.PAN_RIGHT),
      makeState(),
    )
    expect(reward).toBeCloseTo(-0.01)
  })

  it('detects oscillation pattern (ABAB)', () => {
    const prev = makeState()
    const next = makeState()

    calc.calculate(prev, makeAction(ActionType.ZOOM_IN), next)
    calc.calculate(prev, makeAction(ActionType.ZOOM_OUT), next)
    calc.calculate(prev, makeAction(ActionType.ZOOM_IN), next)

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
