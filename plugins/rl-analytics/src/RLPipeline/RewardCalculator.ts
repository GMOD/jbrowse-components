import type { ClassifiedAction } from '../ActionLogger/ActionTypes.ts'
import { ActionType } from '../ActionLogger/ActionTypes.ts'

import type { BrowserState, TaskConfig } from './types.ts'

export default class RewardCalculator {
  private recentActions: ActionType[] = []

  calculate(
    prevState: BrowserState,
    action: ClassifiedAction,
    nextState: BrowserState,
    taskConfig?: TaskConfig,
  ): number {
    let reward = 0

    // 1. Task-based reward (if scavenger hunt active)
    if (taskConfig && nextState.taskActive) {
      const prevDistance = prevState.distanceToTargetBp ?? Infinity
      const nextDistance = nextState.distanceToTargetBp ?? Infinity
      const gamma = 0.99
      const prevPotential = -Math.log1p(Math.abs(prevDistance))
      const nextPotential = -Math.log1p(Math.abs(nextDistance))
      reward += gamma * nextPotential - prevPotential

      // Big bonus for making target visible
      if (nextState.targetVisible && !prevState.targetVisible) {
        reward += 5.0
      }

      // Completion bonus
      if (nextState.targetFullyVisible && taskConfig.type === 'navigate') {
        reward += 10.0
      }
    }

    // 2. Efficiency penalty (small per-step cost encourages shorter paths)
    reward -= 0.01

    // 3. Confusion signals (penalize oscillating/undoing)
    if (this.isOscillation(action)) {
      reward -= 0.5
    }

    return reward
  }

  private isOscillation(action: ClassifiedAction): boolean {
    this.recentActions.push(action.type)
    if (this.recentActions.length > 6) {
      this.recentActions.shift()
    }

    // Check for ABAB pattern
    if (this.recentActions.length >= 4) {
      const last4 = this.recentActions.slice(-4)
      if (
        last4[0] === last4[2] &&
        last4[1] === last4[3] &&
        last4[0] !== last4[1]
      ) {
        return true
      }
    }
    return false
  }

  reset() {
    this.recentActions = []
  }
}
